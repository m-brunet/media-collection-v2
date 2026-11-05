import type {
    CollectionMemberStore,
    MemberRecord,
} from '../../../../application/ports/driven/collection-member-store.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Membership rows, read together with the book information collections need. Only the books
// feature writes books; this adapter only reads them.
export class KyselyCollectionMemberStore implements CollectionMemberStore {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async ofBook(bookId: string): Promise<MemberRecord | null> {
        const [record] = await this.select()
            .where('collection_books.book_id', '=', bookId)
            .execute();

        return record ? this.map(record) : null;
    }

    async ofCollections(collectionIds: readonly string[]): Promise<MemberRecord[]> {
        if (collectionIds.length === 0) {
            return [];
        }

        const rows = await this.select()
            .where('collection_books.collection_id', 'in', collectionIds)
            .orderBy('collection_books.volume_from')
            .orderBy('collection_books.volume_to')
            .orderBy('books.title_key')
            .orderBy('books.id')
            .execute();

        return rows.map((row) => this.map(row));
    }

    async place(
        bookId: string,
        collectionId: string,
        volumeFrom: number,
        volumeTo: number,
    ): Promise<void> {
        await this.remove(bookId);
        await this.db
            .insertInto('collection_books')
            .values({
                book_id: bookId,
                collection_id: collectionId,
                volume_from: volumeFrom,
                volume_to: volumeTo,
            })
            .execute();
    }

    async remove(bookId: string): Promise<void> {
        await this.db.deleteFrom('collection_books').where('book_id', '=', bookId).execute();
    }

    async clear(collectionId: string): Promise<void> {
        await this.db
            .deleteFrom('collection_books')
            .where('collection_id', '=', collectionId)
            .execute();
    }

    private select() {
        return this.db
            .selectFrom('collection_books')
            .innerJoin('books', 'books.id', 'collection_books.book_id')
            .select([
                'collection_books.book_id',
                'collection_books.collection_id',
                'collection_books.volume_from',
                'collection_books.volume_to',
                'books.title',
                'books.isbn13',
                'books.category',
                'books.ownership',
                'books.cover_file',
            ]);
    }

    private map(row: {
        book_id: string;
        collection_id: string;
        volume_from: number;
        volume_to: number;
        title: string;
        isbn13: string | null;
        category: string;
        ownership: string;
        cover_file: string | null;
    }): MemberRecord {
        return {
            bookId: row.book_id,
            collectionId: row.collection_id,
            volumeFrom: row.volume_from,
            volumeTo: row.volume_to,
            title: row.title,
            isbn: row.isbn13,
            category: row.category as MemberRecord['category'],
            ownership: row.ownership as MemberRecord['ownership'],
            hasCover: row.cover_file !== null,
        };
    }
}
