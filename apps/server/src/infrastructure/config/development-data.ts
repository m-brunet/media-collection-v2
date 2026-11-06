import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { dirname, join } from 'node:path';
import { LibraryModules } from './library-modules.js';
import { Database } from '../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyAuditTrail } from '../../shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
import { SystemClock } from '../../shared/infrastructure/adapters/driven/runtime/system-clock.adapter.js';
import { UuidGenerator } from '../../shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { AuditedOperation } from '../../shared/application/services/audited-operation.service.js';
import type { ImportBookUseCase } from '../../books/application/ports/driving/import-book-use-case.interface.js';
import type { FinishCollectionUseCase } from '../../collections/application/ports/driving/finish-collection-use-case.interface.js';
import type { V1ImportReport } from '../../development-data/application/ports/driving/import-v1-library-use-case.interface.js';
import { ImportV1Library } from '../../development-data/application/use-cases/import-v1-library.usecase.js';
import { ResetDevelopmentData } from '../../development-data/application/use-cases/reset-development-data.usecase.js';
import { KyselyLibraryEraser } from '../../development-data/infrastructure/adapters/driven/persistence/kysely-library-eraser.adapter.js';
import { KyselyCoverFileCleanup } from '../../development-data/infrastructure/adapters/driven/persistence/kysely-cover-file-cleanup.adapter.js';
import { KyselyLibraryAdministrator } from '../../development-data/infrastructure/adapters/driven/persistence/kysely-library-administrator.adapter.js';
import { JsonV1Dump } from '../../development-data/infrastructure/adapters/driven/filesystem/json-v1-dump.adapter.js';
import { CachedCoverDownloads } from '../../development-data/infrastructure/adapters/driven/third-party/cached-cover-downloads.adapter.js';

// Root of the application context that hosts the library features without HTTP listeners.
@Module({})
class DevelopmentDataContext {}

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

    // `source` is the V1 books.json; its corrections and the cover cache live in the same folder.
    static async importV1(dataDirectory: string, source: string): Promise<string[]> {
        const ids = new UuidGenerator();
        const clock = new SystemClock();
        const database = await Database.open(dataDirectory, ids);

        try {
            const operations = new AuditedOperation(
                database.connections,
                new KyselyAuditTrail(database.connections, ids),
                clock,
                ids,
            );
            const context = await NestFactory.createApplicationContext(
                {
                    module: DevelopmentDataContext,
                    imports: LibraryModules.register({
                        database,
                        dataDirectory,
                        ids,
                        clock,
                        operations,
                    }),
                },
                { logger: false, abortOnError: false },
            );

            try {
                const lookup = { strict: false };

                console.log('Checking ' + source + ' and fetching its covers…');
                const report = await new ImportV1Library(
                    new JsonV1Dump(source),
                    new CachedCoverDownloads(join(dirname(source), 'covers')),
                    new KyselyLibraryAdministrator(database.connections),
                    new KyselyLibraryEraser(database.connections),
                    new KyselyCoverFileCleanup(database.connections, dataDirectory),
                    database.connections,
                    context.get<ImportBookUseCase>('BOOKS_IMPORT', lookup),
                    context.get<FinishCollectionUseCase>('COLLECTIONS_FINISH', lookup),
                ).execute();

                return DevelopmentDataCommands.importLines(dataDirectory, report);
            } finally {
                await context.close();
            }
        } finally {
            await database.close();
        }
    }

    private static importLines(dataDirectory: string, report: V1ImportReport): string[] {
        return [
            'Development library in ' + dataDirectory + ' replaced by the V1 dump.',
            'Removed the previous ' +
                report.erased.books +
                ' books, ' +
                report.erased.collections +
                ' collections and ' +
                report.erased.loans +
                ' loans; accounts and server settings were kept.',
            'Imported ' +
                report.books +
                ' books in ' +
                report.collections +
                ' collections, with ' +
                report.coversStored +
                ' covers.',
            'Marked Finished: ' +
                (report.finished.length ? report.finished.join(', ') : 'none') +
                '.',
            ...report.unfinished.map(
                (collection) =>
                    'Left unfinished: ' +
                    collection.name +
                    ' (last volume ' +
                    collection.lastVolume +
                    (collection.missing.length
                        ? '; missing ' + collection.missing.join(', ')
                        : '') +
                    (collection.beyond.length
                        ? '; beyond it ' + collection.beyond.join(', ')
                        : '') +
                    ').',
            ),
            ...report.coversSkipped.map(
                (skipped) =>
                    'No cover for record ' +
                    skipped.record +
                    ' (' +
                    skipped.title +
                    '): ' +
                    (skipped.reason === 'unusable'
                        ? 'not a JPEG, PNG or WebP image.'
                        : 'could not be downloaded.'),
            ),
        ];
    }
}
