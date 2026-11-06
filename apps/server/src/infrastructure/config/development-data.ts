import { Database } from '../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { ResetDevelopmentData } from '../../development-data/application/use-cases/reset-development-data.usecase.js';
import { KyselyLibraryEraser } from '../../development-data/infrastructure/adapters/driven/persistence/kysely-library-eraser.adapter.js';
import { KyselyCoverFileCleanup } from '../../development-data/infrastructure/adapters/driven/persistence/kysely-cover-file-cleanup.adapter.js';

// Composition of the development data commands, run by the Electron worker without listeners once
// the main process has confirmed the directory is the repository's development data. Each command
// brings the schema up to date first, then returns the lines to print in the terminal.
export class DevelopmentDataCommands {
    static async reset(dataDirectory: string): Promise<string[]> {
        const database = await Database.open(dataDirectory, new UuidGenerator());

        try {
            const report = await new ResetDevelopmentData(
                new KyselyLibraryEraser(database.connections),
                new KyselyCoverFileCleanup(database.connections, dataDirectory),
                database.connections,
            ).execute();

            return [
                'Development library emptied in ' + dataDirectory + '.',
                'Deleted ' +
                    report.books +
                    ' books, ' +
                    report.authors +
                    ' authors, ' +
                    report.collections +
                    ' collections, ' +
                    report.loans +
                    ' loans and ' +
                    report.removedCoverFiles +
                    ' cover files.',
                'Accounts and server settings were kept; every session was signed out.',
            ];
        } finally {
            await database.close();
        }
    }

    static importV1(_dataDirectory: string, _source: string): Promise<string[]> {
        return Promise.reject(new Error('The V1 import is not available yet.'));
    }
}
