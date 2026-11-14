import { Required } from '../../../shared/domain/required.helper.js';
export interface ActivityRecord {
    category: string;
    subjectId: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    currentTitle: string | null;
}

export interface ActivityOperation {
    id: string;
    occurredAt: string;
    actorId: string | null;
    actor: string | null;
    records: readonly ActivityRecord[];
}

export type BookEventKind =
    | 'book-added'
    | 'book-updated'
    | 'book-marked-owned'
    | 'book-deleted'
    | 'book-relocated'
    | 'book-retagged'
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

export type ActivityEvent =
    | { kind: BookEventKind; title: string | null }
    | { kind: 'books-lent' | 'books-returned'; receiver: string; titles: string[] }
    | { kind: NamedEventKind; name: string }
    | { kind: RenamedEventKind; from: string; to: string }
    | { kind: 'volumes-added'; name: string; count: number }
    | {
          kind: 'collection-category-changed';
          name: string;
          category: ActivityCategory;
          count: number;
      }
    | { kind: 'shelf-created' | 'shelf-deleted'; name: string; bookcase: string }
    | { kind: 'shelf-renamed'; from: string; to: string; bookcase: string }
    | { kind: 'shelf-moved'; name: string; from: string; to: string };

export type ActivityCategory = 'books' | 'manga' | 'comics';

export interface ActivityEntry {
    id: string;
    occurredAt: string;
    actor: string | null;
    event: ActivityEvent;
    also: ActivityEvent[];
}

type Values = Record<string, unknown> | null;

export class ActivityProjection {
    private static readonly order: readonly (readonly string[])[] = [
        [
            'collection.volumes-added',
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
        ['book.retitled', 'book.category-changed'],
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
        const absorbed = ActivityProjection.absorbs[main.category] ?? [];
        const event = ActivityProjection.event(main.category, together, readable);

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
                        record.category !== main.category &&
                        !absorbed.includes(record.category) &&
                        !ActivityProjection.consequences.includes(record.category),
                )
                .map((record) => ActivityProjection.event(record.category, [record], readable))
                .filter((also): also is ActivityEvent => also !== null),
        };
    }

    private static readonly categories: readonly ActivityCategory[] = ['books', 'manga', 'comics'];

    private static readonly consequences: readonly string[] = [
        'book.retitled',
        'book.category-changed',
    ];

    private static readonly absorbs: Readonly<Record<string, readonly string[]>> = {
        'collection.volumes-added': ['book.created'],
    };

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
        operation: readonly ActivityRecord[],
    ): ActivityEvent | null {
        const record = Required.at(records, 0, 'an event has at least one record');
        const { before, after } = record;
        const current = after ?? before;

        switch (category) {
            case 'book.created':
                return ActivityProjection.book('book-added', record);
            case 'collection.volumes-added':
                return ActivityProjection.volumesAdded(after);
            case 'book.updated':
            case 'book.retitled':
                return ActivityProjection.book('book-updated', record);
            case 'book.marked-owned':
                return ActivityProjection.book('book-marked-owned', record);
            case 'book.deleted':
                return ActivityProjection.book('book-deleted', record);
            case 'book.organised':
                return ActivityProjection.book(ActivityProjection.organised(before, after), record);
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

                if (renamed && renamed.from !== renamed.to) {
                    return renamed;
                }

                return (
                    ActivityProjection.recategorised(before, after, operation) ??
                    ActivityProjection.named('collection-updated', current)
                );
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

    private static volumesAdded(after: Values): ActivityEvent | null {
        const name = ActivityProjection.text(after, 'name');
        const added = after?.added;

        return name && Array.isArray(added) && added.length > 0
            ? { kind: 'volumes-added', name, count: added.length }
            : null;
    }

    private static book(kind: BookEventKind, record: ActivityRecord): ActivityEvent {
        const title =
            ActivityProjection.text(record.after, 'title') ??
            ActivityProjection.text(record.before, 'title') ??
            record.currentTitle;

        return { kind, title };
    }

    private static organised(before: Values, after: Values): BookEventKind {
        if (!before || !after) {
            return 'book-organised';
        }

        const relocated =
            ActivityProjection.shelfId(before.location) !==
            ActivityProjection.shelfId(after.location);
        const retagged =
            ActivityProjection.tagIds(before.tags) !== ActivityProjection.tagIds(after.tags);

        if (relocated && !retagged) {
            return 'book-relocated';
        }

        if (retagged && !relocated) {
            return 'book-retagged';
        }

        return 'book-organised';
    }

    private static shelfId(location: unknown): string | null {
        return ActivityProjection.text(ActivityProjection.values(location), 'shelfId');
    }

    private static tagIds(tags: unknown): string {
        return Array.isArray(tags)
            ? tags
                  .map((tag) => ActivityProjection.text(ActivityProjection.values(tag), 'id') ?? '')
                  .sort()
                  .join(',')
            : '';
    }

    private static loans(
        kind: 'books-lent' | 'books-returned',
        records: readonly ActivityRecord[],
    ): ActivityEvent | null {
        const loans = records.map(
            (record) =>
                ActivityProjection.values(record.after?.loan) ??
                ActivityProjection.values(record.before?.loan),
        );
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

    private static recategorised(
        before: Values,
        after: Values,
        operation: readonly ActivityRecord[],
    ): ActivityEvent | null {
        const name = ActivityProjection.text(after, 'name');
        const category = ActivityProjection.categories.find(
            (candidate) => candidate === ActivityProjection.text(after, 'category'),
        );

        if (!name || !category || category === ActivityProjection.text(before, 'category')) {
            return null;
        }

        const count = operation.filter(
            (record) => record.category === 'book.category-changed',
        ).length;

        return { kind: 'collection-category-changed', name, category, count };
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
