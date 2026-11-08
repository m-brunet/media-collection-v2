import type { LibraryContentsReader } from '../../../../application/ports/driven/library-contents-reader.interface.js';
import type { BackupContents } from '../../../../domain/value-objects/backup-manifest.value-object.js';
import type { DatabaseSession } from './database-session.adapter.js';

export class KyselyLibraryContents implements LibraryContentsReader {
    constructor(private readonly session: DatabaseSession) {}

    read(): Promise<BackupContents> {
        return this.session.use(async (connections) => {
            const db = connections.current;
            const books = await db
                .selectFrom('books')
                .select((eb) => eb.fn.countAll<number>().as('count'))
                .executeTakeFirstOrThrow();
            const accounts = await db
                .selectFrom('users')
                .select((eb) => eb.fn.countAll<number>().as('count'))
                .executeTakeFirstOrThrow();

            return { books: Number(books.count), accounts: Number(accounts.count) };
        });
    }
}
