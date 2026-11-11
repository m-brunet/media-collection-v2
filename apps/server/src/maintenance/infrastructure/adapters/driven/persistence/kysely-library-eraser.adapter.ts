import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export type ErasedLibrary = { books: number; authors: number; collections: number; loans: number };

export class KyselyLibraryEraser {
    constructor(private readonly connections: DatabaseConnections) {}

    async erase(): Promise<ErasedLibrary> {
        const db = this.connections.current;
        const loans = await db.deleteFrom('loans').executeTakeFirst();

        await db.deleteFrom('receivers').execute();
        await db.deleteFrom('book_tags').execute();
        await db.deleteFrom('tags').execute();
        await db.deleteFrom('book_shelves').execute();
        await db.deleteFrom('shelves').execute();
        await db.deleteFrom('bookcases').execute();
        await db.deleteFrom('collection_books').execute();
        const collections = await db.deleteFrom('collections').executeTakeFirst();

        await db.deleteFrom('book_authors').execute();
        await db.deleteFrom('reading_statuses').execute();
        await db.deleteFrom('personal_notes').execute();
        const books = await db.deleteFrom('books').executeTakeFirst();
        const authors = await db.deleteFrom('authors').executeTakeFirst();

        await db.deleteFrom('audit_logs').execute();
        await db
            .updateTable('users')
            .set((eb) => ({ token_version: eb('token_version', '+', 1) }))
            .execute();

        return {
            books: Number(books.numDeletedRows),
            authors: Number(authors.numDeletedRows),
            collections: Number(collections.numDeletedRows),
            loans: Number(loans.numDeletedRows),
        };
    }
}
