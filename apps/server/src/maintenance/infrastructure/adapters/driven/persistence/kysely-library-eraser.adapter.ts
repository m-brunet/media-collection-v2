import type {
    ErasedLibrary,
    LibraryEraser,
} from '../../../../application/ports/driven/library-eraser.interface.js';
import type { KeptCoverStore } from '../../../../../books/application/ports/driven/kept-cover-store.interface.js';
import type { Clock } from '../../../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyLibraryEraser implements LibraryEraser {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly kept: KeptCoverStore,
    ) {}

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
        await this.keepCovers();
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

    private async keepCovers(): Promise<void> {
        const keptAt = this.clock.now().toISOString();
        const covers = await this.connections.current
            .selectFrom('books')
            .select(['isbn13', 'cover_file'])
            .where('isbn13', 'is not', null)
            .where('cover_file', 'is not', null)
            .execute();

        for (const { isbn13, cover_file: file } of covers) {
            if (isbn13 === null || file === null) {
                continue;
            }

            await this.kept.put({ id: this.ids.next(), isbn13, file, keptAt });
        }
    }
}
