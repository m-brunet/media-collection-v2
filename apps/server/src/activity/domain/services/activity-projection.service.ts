// One Successful, eligible audit record, as Activity reads it.
export interface ActivityRecord {
    category: string;
    subjectId: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    // The book's current title when the record concerns a book, for older records that did not
    // store one; null when the book no longer exists or the record is not about a book.
    currentTitle: string | null;
}

// The records of one audited operation, sharing its ID, time and acting account.
export interface ActivityOperation {
    id: string;
    occurredAt: string;
    actorId: string | null;
    // The acting account's current username; null when no account was recorded.
    actor: string | null;
    records: readonly ActivityRecord[];
}

export type BookEventKind =
    | 'book-added'
    | 'book-updated'
    | 'book-marked-owned'
    | 'book-deleted'
    | 'book-organised'
    | 'book-cover-changed';

export type NamedEventKind =
    | 'collection-created'
    | 'collection-updated'
    | 'collection-finished'
    | 'collection-reopened'
    | 'collection-deleted'
    | 'collection-removed'
    | 'bookcase-created'
    | 'bookcase-deleted'
    | 'tag-created'
    | 'tag-deleted'
    | 'receiver-created';

export type RenamedEventKind =
    | 'author-corrected'
    | 'collection-renamed'
    | 'bookcase-renamed'
    | 'tag-renamed';

// What happened, with the names needed to say it. Libris writes the sentence ("You …").
export type ActivityEvent =
    // `title` is null only for an older record of a book deleted since.
    | { kind: BookEventKind; title: string | null }
    | { kind: 'books-lent' | 'books-returned'; receiver: string; titles: string[] }
    | { kind: NamedEventKind; name: string }
    | { kind: RenamedEventKind; from: string; to: string }
    | { kind: 'shelf-created' | 'shelf-deleted'; name: string; bookcase: string }
    | { kind: 'shelf-renamed'; from: string; to: string; bookcase: string }
    | { kind: 'shelf-moved'; name: string; from: string; to: string };

// One Activity entry: the operation's main change and the changes it caused ("Also …").
export interface ActivityEntry {
    id: string;
    occurredAt: string;
    actor: string | null;
    event: ActivityEvent;
    also: ActivityEvent[];
}

type Values = Record<string, unknown> | null;

// Turns one operation's audit records into one Activity entry. The main record is chosen by
// category, since records of one operation have no reliable order: a person's change to a book
// or a loan first, then their change to a collection, location or tag, then the consequences of
// the operation (collections created, reopened or removed by a book save, a tag created from the
// book form, a new receiver), and last the titles retitled by a collection change, which are
// never listed. Every record of the main category joins the main change, so lending three books
// is one entry naming three titles.
export class ActivityProjection {
    private static readonly order: readonly (readonly string[])[] = [
        [
            'book.created',
            'book.updated',
            'book.marked-owned',
            'book.deleted',
            'book.organised',
            'book.cover-changed',
            'author.corrected',
            'loan.lent',
            'loan.returned',
        ],
        [
            'collection.deleted',
            'collection.finished',
            'bookcase.created',
            'bookcase.renamed',
            'bookcase.deleted',
            'shelf.created',
            'shelf.renamed',
            'shelf.moved',
            'shelf.deleted',
            'tag.renamed',
            'tag.deleted',
        ],
        [
            'collection.updated',
            'collection.reopened',
            'collection.created',
            'collection.removed',
            'tag.created',
            'receiver.created',
        ],
        ['book.retitled'],
    ];

    static entry(operation: ActivityOperation): ActivityEntry | null {
        const readable = operation.records.filter(
            (record) => ActivityProjection.position(record.category) >= 0,
        );
        const main = ActivityProjection.main(readable);

        if (!main) {
            return null;
        }

        const together = readable.filter((record) => record.category === main.category);
        const event = ActivityProjection.event(main.category, together);

        if (!event) {
            return null;
        }

        return {
            id: operation.id,
            occurredAt: operation.occurredAt,
            actor: operation.actor,
            event,
            also: readable
                .filter(
                    (record) =>
                        record.category !== main.category && record.category !== 'book.retitled',
                )
                .map((record) => ActivityProjection.event(record.category, [record]))
                .filter((also): also is ActivityEvent => also !== null),
        };
    }

    private static main(records: readonly ActivityRecord[]): ActivityRecord | undefined {
        return [...records].sort(
            (a, b) =>
                ActivityProjection.position(a.category) - ActivityProjection.position(b.category),
        )[0];
    }

    private static position(category: string): number {
        return ActivityProjection.order.flat().indexOf(category);
    }

    private static event(
        category: string,
        records: readonly ActivityRecord[],
    ): ActivityEvent | null {
        const record = records[0]!;
        const { before, after } = record;
        const current = after ?? before;

        switch (category) {
            case 'book.created':
                return ActivityProjection.book('book-added', record);
            case 'book.updated':
            case 'book.retitled':
                return ActivityProjection.book('book-updated', record);
            case 'book.marked-owned':
                return ActivityProjection.book('book-marked-owned', record);
            case 'book.deleted':
                return ActivityProjection.book('book-deleted', record);
            case 'book.organised':
                return ActivityProjection.book('book-organised', record);
            case 'book.cover-changed':
                return ActivityProjection.book('book-cover-changed', record);
            case 'loan.lent':
                return ActivityProjection.loans('books-lent', records);
            case 'loan.returned':
                return ActivityProjection.loans('books-returned', records);
            case 'author.corrected':
                return ActivityProjection.renamed('author-corrected', before, after);
            case 'collection.updated': {
                const renamed = ActivityProjection.renamed('collection-renamed', before, after);

                return renamed && renamed.from !== renamed.to
                    ? renamed
                    : ActivityProjection.named('collection-updated', current);
            }
            case 'collection.created':
                return ActivityProjection.named('collection-created', current);
            case 'collection.finished':
                return ActivityProjection.named('collection-finished', current);
            case 'collection.reopened':
                return ActivityProjection.named('collection-reopened', current);
            case 'collection.deleted':
                return ActivityProjection.named('collection-deleted', current);
            case 'collection.removed':
                return ActivityProjection.named('collection-removed', current);
            case 'bookcase.created':
                return ActivityProjection.named('bookcase-created', current);
            case 'bookcase.renamed':
                return ActivityProjection.renamed('bookcase-renamed', before, after);
            case 'bookcase.deleted':
                return ActivityProjection.named('bookcase-deleted', current);
            case 'shelf.created':
                return ActivityProjection.shelf('shelf-created', current);
            case 'shelf.deleted':
                return ActivityProjection.shelf('shelf-deleted', current);
            case 'shelf.renamed':
                return ActivityProjection.shelfRenamed(before, after);
            case 'shelf.moved':
                return ActivityProjection.moved(before, after);
            case 'tag.created':
                return ActivityProjection.named('tag-created', current);
            case 'tag.renamed':
                return ActivityProjection.renamed('tag-renamed', before, after);
            case 'tag.deleted':
                return ActivityProjection.named('tag-deleted', current);
            case 'receiver.created':
                return ActivityProjection.named('receiver-created', current);
            default:
                return null;
        }
    }

    private static book(kind: BookEventKind, record: ActivityRecord): ActivityEvent {
        const title =
            ActivityProjection.text(record.after, 'title') ??
            ActivityProjection.text(record.before, 'title') ??
            record.currentTitle;

        return { kind, title };
    }

    private static loans(
        kind: 'books-lent' | 'books-returned',
        records: readonly ActivityRecord[],
    ): ActivityEvent | null {
        const loans = records.map((record) => record.after ?? record.before);
        const receiver = ActivityProjection.text(
            ActivityProjection.values(loans[0]?.receiver ?? null),
            'name',
        );
        const titles = loans
            .map((loan) => ActivityProjection.text(loan, 'title'))
            .filter((title): title is string => title !== null)
            .sort((a, b) => a.localeCompare(b));

        return receiver && titles.length > 0 ? { kind, receiver, titles } : null;
    }

    private static named(kind: NamedEventKind, values: Values): ActivityEvent | null {
        const name = ActivityProjection.text(values, 'name');

        return name ? { kind, name } : null;
    }

    private static renamed(
        kind: RenamedEventKind,
        before: Values,
        after: Values,
    ): { kind: RenamedEventKind; from: string; to: string } | null {
        const from = ActivityProjection.text(before, 'name');
        const to = ActivityProjection.text(after, 'name');

        return from && to ? { kind, from, to } : null;
    }

    private static shelf(
        kind: 'shelf-created' | 'shelf-deleted',
        values: Values,
    ): ActivityEvent | null {
        const name = ActivityProjection.text(values, 'name');
        const bookcase = ActivityProjection.text(values, 'bookcaseName');

        return name && bookcase ? { kind, name, bookcase } : null;
    }

    private static shelfRenamed(before: Values, after: Values): ActivityEvent | null {
        const from = ActivityProjection.text(before, 'name');
        const to = ActivityProjection.text(after, 'name');
        const bookcase = ActivityProjection.text(after, 'bookcaseName');

        return from && to && bookcase ? { kind: 'shelf-renamed', from, to, bookcase } : null;
    }

    private static moved(before: Values, after: Values): ActivityEvent | null {
        const name = ActivityProjection.text(after, 'name');
        const from = ActivityProjection.text(before, 'bookcaseName');
        const to = ActivityProjection.text(after, 'bookcaseName');

        return name && from && to ? { kind: 'shelf-moved', name, from, to } : null;
    }

    private static text(values: Values, key: string): string | null {
        const value = values?.[key];

        return typeof value === 'string' && value.length > 0 ? value : null;
    }

    private static values(value: unknown): Values {
        return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
    }
}
