import type { CollectionDetailsView } from '../../../apps/server/src/collections/application/collection-views.js';
import { CollectionViewer } from '../../../apps/server/src/collections/application/services/collection-viewer.service.js';
import { KyselyCollectionMemberStore } from '../../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-collection-member-store.adapter.js';
import { KyselyCollectionRepository } from '../../../apps/server/src/collections/infrastructure/adapters/driven/persistence/kysely-collection.repository.js';
import type { Database } from '../../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';

export interface LocationRecord {
    bookcaseName: string;
    shelfName: string;
}

export interface LoanRecord {
    bookId: string | null;
    receiverName: string;
    status: string;
    bookTitle: string;
    bookIsbn: string | null;
}

export interface BookcaseRecord {
    name: string;
    shelves: string[];
}

// Read-only view of the stored library for API test assertions, so a case checks the state its
// request left without sending a second request.
export class LibraryProbe {
    constructor(private readonly database: Database) {}

    private get db() {
        return this.database.connection;
    }

    async bookIds(): Promise<string[]> {
        const rows = await this.db.selectFrom('books').select('id').orderBy('id').execute();

        return rows.map((row) => row.id);
    }

    async title(bookId: string): Promise<{ title: string; titleGenerated: boolean } | null> {
        const row = await this.db
            .selectFrom('books')
            .select(['title', 'title_generated'])
            .where('id', '=', bookId)
            .executeTakeFirst();

        return row ? { title: row.title, titleGenerated: row.title_generated === 1 } : null;
    }

    async ownership(bookId: string): Promise<string | null> {
        const row = await this.db
            .selectFrom('books')
            .select('ownership')
            .where('id', '=', bookId)
            .executeTakeFirst();

        return row?.ownership ?? null;
    }

    // Every loan occurrence, completed ones included, in lending order (then by title).
    async loans(): Promise<LoanRecord[]> {
        return (
            this.db
                .selectFrom('loans')
                .innerJoin('receivers', 'receivers.id', 'loans.receiver_id')
                .select([
                    'loans.book_id as bookId',
                    'receivers.name as receiverName',
                    'loans.status',
                    'loans.book_title as bookTitle',
                    'loans.book_isbn as bookIsbn',
                ])
                .orderBy('loans.lent_at')
                // At one instant, an earlier completed occurrence comes before the active one.
                .orderBy('loans.status', 'desc')
                .orderBy('loans.book_title')
                .execute()
        );
    }

    // Receiver names, in name order.
    async receivers(): Promise<string[]> {
        const rows = await this.db
            .selectFrom('receivers')
            .select('name')
            .orderBy('name_key')
            .execute();

        return rows.map((row) => row.name);
    }

    async location(bookId: string): Promise<LocationRecord | null> {
        const row = await this.db
            .selectFrom('book_shelves')
            .innerJoin('shelves', 'shelves.id', 'book_shelves.shelf_id')
            .innerJoin('bookcases', 'bookcases.id', 'shelves.bookcase_id')
            .select(['bookcases.name as bookcaseName', 'shelves.name as shelfName'])
            .where('book_shelves.book_id', '=', bookId)
            .executeTakeFirst();

        return row ?? null;
    }

    // Tag names of a book, in name order.
    async tags(bookId: string): Promise<string[]> {
        const rows = await this.db
            .selectFrom('book_tags')
            .innerJoin('tags', 'tags.id', 'book_tags.tag_id')
            .select('tags.name')
            .where('book_tags.book_id', '=', bookId)
            .orderBy('tags.name_key')
            .execute();

        return rows.map((row) => row.name);
    }

    // Bookcases with their shelf names, both in name order.
    async bookcases(): Promise<BookcaseRecord[]> {
        const bookcases = await this.db
            .selectFrom('bookcases')
            .select(['id', 'name'])
            .orderBy('name_key')
            .execute();
        const shelves = await this.db
            .selectFrom('shelves')
            .select(['bookcase_id', 'name'])
            .orderBy('name_key')
            .execute();

        return bookcases.map((bookcase) => ({
            name: bookcase.name,
            shelves: shelves
                .filter((shelf) => shelf.bookcase_id === bookcase.id)
                .map((shelf) => shelf.name),
        }));
    }

    async collectionNames(): Promise<string[]> {
        const rows = await this.db
            .selectFrom('collections')
            .select('name')
            .orderBy('name_key')
            .execute();

        return rows.map((row) => row.name);
    }

    // The name of the collection a book belongs to.
    async collectionOf(bookId: string): Promise<string | null> {
        const row = await this.db
            .selectFrom('collection_books')
            .innerJoin('collections', 'collections.id', 'collection_books.collection_id')
            .select('collections.name')
            .where('collection_books.book_id', '=', bookId)
            .executeTakeFirst();

        return row?.name ?? null;
    }

    // A collection as its details page describes it, computed by the collections feature itself.
    async collection(collectionId: string): Promise<CollectionDetailsView | null> {
        const collections = new KyselyCollectionRepository(this.database.connections);
        const members = new KyselyCollectionMemberStore(this.database.connections);
        const collection = await collections.findById(collectionId);

        return collection
            ? new CollectionViewer().details(
                  collection,
                  await members.ofCollections([collectionId]),
              )
            : null;
    }
}
