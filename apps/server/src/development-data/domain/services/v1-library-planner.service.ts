import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';

export type V1Category = 'books' | 'manga' | 'comics';

// One book of the V1 (MongoDB) dump, decoded but not yet interpreted. `record` is its position
// in the dump, from 1.
export interface V1Book {
    record: number;
    title: string | null;
    isbn: string | null;
    authors: string[];
    type: string;
    bought: boolean;
    read: string | null;
    volume: number | null;
    collectionName: string | null;
    lastElement: boolean;
    pageCount: number | null;
    price: number | null;
    publisher: string | null;
    cover: string | null;
    // ISO 8601.
    created: string;
}

// Local corrections kept beside the dump: ISBNs missing in V1 (by record, its title checked) and
// the category of every book of a collection.
export interface V1Corrections {
    isbns: { record: number; title: string; isbn: string }[];
    categories: { collection: string; category: V1Category }[];
}

export interface PlannedBook {
    record: number;
    // Blank: generated from the collection (Manga and Comics only).
    title: string;
    isbn: string;
    authors: string[];
    category: V1Category;
    ownership: 'owned' | 'not-owned';
    publisher: string | null;
    pageCount: number | null;
    price: string | null;
    collection: { name: string; volume: number } | null;
    createdAt: string;
    read: boolean;
    coverUrl: string | null;
}

// A collection whose V1 books mark a last volume, but which V2 cannot mark Finished.
export interface UnfinishedCollection {
    name: string;
    lastVolume: number;
    missing: number[];
    beyond: number[];
}

export interface V1LibraryPlan {
    books: PlannedBook[];
    // Collection names (as first written) to mark Finished once their books are saved.
    finished: string[];
    unfinished: UnfinishedCollection[];
    // Untitled Books in a collection, given the collection title (`Name Vol. N`) as a supplied title,
    // since V2 only generates titles for Manga and Comics.
    titled: { record: number; title: string }[];
}

const types: Record<string, V1Category> = { book: 'books', manga: 'manga', comics: 'comics' };

// The agreed V1 → V2 rules. Every problem of the whole dump is reported at once, before anything
// is written, so the corrections can be completed in one go.
export class V1LibraryPlanner {
    static plan(books: readonly V1Book[], corrections: V1Corrections): V1LibraryPlan {
        const problems: string[] = [];
        const isbns = V1LibraryPlanner.isbnCorrections(books, corrections, problems);
        const categories = new Map(
            corrections.categories.map((entry) => [NameKey.of(entry.collection), entry.category]),
        );
        const titled: V1LibraryPlan['titled'] = [];
        const planned = books.flatMap((book) => {
            const result = V1LibraryPlanner.book(book, isbns, categories, problems, titled);

            return result ? [result] : [];
        });

        if (problems.length > 0) {
            throw new Failure(
                'invalid_input',
                'The V1 dump needs corrections before it can be imported:\n- ' +
                    problems.join('\n- '),
                'v1-dump-invalid',
            );
        }

        return { books: planned, titled, ...V1LibraryPlanner.completion(books, planned) };
    }

    private static isbnCorrections(
        books: readonly V1Book[],
        corrections: V1Corrections,
        problems: string[],
    ): Map<number, string> {
        const byRecord = new Map<number, string>();

        for (const correction of corrections.isbns) {
            const book = books.find((candidate) => candidate.record === correction.record);

            if (!book || (book.title ?? '').trim() !== correction.title.trim()) {
                problems.push(
                    'ISBN correction for record ' +
                        correction.record +
                        ' ("' +
                        correction.title +
                        '") does not match the dump.',
                );
            } else {
                byRecord.set(correction.record, correction.isbn);
            }
        }

        return byRecord;
    }

    private static book(
        book: V1Book,
        isbns: Map<number, string>,
        categories: Map<string, V1Category>,
        problems: string[],
        titled: V1LibraryPlan['titled'],
    ): PlannedBook | null {
        const label =
            'Record ' + book.record + (book.title?.trim() ? ' ("' + book.title.trim() + '")' : '');
        const collectionName = book.collectionName?.trim() || null;
        const category =
            (collectionName ? categories.get(NameKey.of(collectionName)) : undefined) ??
            types[book.type];
        const isbn = book.isbn?.trim() || isbns.get(book.record) || null;
        let title = book.title?.trim() ?? '';
        const count = problems.length;

        if (!category) {
            problems.push(label + ': unknown V1 type "' + book.type + '".');
        }

        if (!isbn) {
            problems.push(label + ': no ISBN; add it to isbn-corrections.json.');
        }

        if (
            collectionName &&
            (book.volume === null || !Number.isInteger(book.volume) || book.volume < 0)
        ) {
            problems.push(label + ': collection "' + collectionName + '" without a valid volume.');
        }

        if (!title && !collectionName) {
            problems.push(label + ': no title, and no collection to give it one.');
        }

        if (problems.length > count || !category || !isbn) {
            return null;
        }

        if (!title && category === 'books') {
            title = collectionName + ' Vol. ' + book.volume;
            titled.push({ record: book.record, title });
        }

        return {
            record: book.record,
            title,
            isbn,
            authors: book.authors.map((author) => author.trim()).filter((author) => author !== ''),
            category,
            ownership: book.bought ? 'owned' : 'not-owned',
            publisher: book.publisher?.trim() || null,
            pageCount: book.pageCount === 0 ? null : book.pageCount,
            price: book.price === null ? null : String(Math.round(book.price * 100) / 100),
            collection: collectionName ? { name: collectionName, volume: book.volume! } : null,
            createdAt: book.created,
            read: book.read === 'READ',
            coverUrl: book.cover?.trim() || null,
        };
    }

    // `lastElement` marks the last volume of a finished series; the highest marked volume wins.
    // V2 only marks a collection Finished when every volume up to it is present and Owned.
    private static completion(
        books: readonly V1Book[],
        planned: readonly PlannedBook[],
    ): Pick<V1LibraryPlan, 'finished' | 'unfinished'> {
        const marked = new Set(books.filter((book) => book.lastElement).map((book) => book.record));
        const groups = new Map<string, PlannedBook[]>();

        for (const book of planned) {
            if (book.collection) {
                const key = NameKey.of(book.collection.name);

                groups.set(key, [...(groups.get(key) ?? []), book]);
            }
        }

        const finished: string[] = [];
        const unfinished: UnfinishedCollection[] = [];

        for (const members of groups.values()) {
            const lasts = members
                .filter((book) => marked.has(book.record))
                .map((book) => book.collection!.volume);

            if (lasts.length === 0) {
                continue;
            }

            const name = members[0]!.collection!.name;
            const lastVolume = Math.max(...lasts);
            const owned = new Set(
                members
                    .filter((book) => book.ownership === 'owned')
                    .map((book) => book.collection!.volume),
            );
            const first = members.some((book) => book.collection!.volume === 0) ? 0 : 1;
            const missing: number[] = [];

            for (let volume = first; volume <= lastVolume; volume++) {
                if (!owned.has(volume)) {
                    missing.push(volume);
                }
            }

            const beyond = [
                ...new Set(
                    members
                        .map((book) => book.collection!.volume)
                        .filter((volume) => volume > lastVolume),
                ),
            ].sort((a, b) => a - b);

            if (missing.length === 0 && beyond.length === 0) {
                finished.push(name);
            } else {
                unfinished.push({ name, lastVolume, missing, beyond });
            }
        }

        return { finished, unfinished };
    }
}
