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
import { ImportV1Library } from '../../development-data/application/use-cases/import-v1-library.usecase.js';
import { ResetDevelopmentData } from '../../development-data/application/use-cases/reset-development-data.usecase.js';
import { KyselyLibraryEraser } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-library-eraser.adapter.js';
import { KyselyCoverFileCleanup } from '../../maintenance/infrastructure/adapters/driven/persistence/kysely-cover-file-cleanup.adapter.js';
import { IdentityModule } from '../../identity/infrastructure/config/identity.module.js';
import { KyselyUserRepository } from '../../identity/infrastructure/adapters/driven/persistence/kysely-user.repository.js';
import { JsonV1Dump } from '../../development-data/infrastructure/adapters/driven/filesystem/json-v1-dump.adapter.js';
import { DevelopmentDataReport } from '../../development-data/infrastructure/adapters/driving/command-line/development-data-report.adapter.js';
import { FileCoverStorage } from '../../books/infrastructure/adapters/driven/filesystem/file-cover-storage.adapter.js';
import { CachedCoverDownloads } from '../../development-data/infrastructure/adapters/driven/third-party/cached-cover-downloads.adapter.js';

@Module({})
class DevelopmentDataContext {}

// Composition of the development data commands, run by the Electron worker without listeners once
// the main process has confirmed the directory is the repository's development data.
export class DevelopmentDataCommands {
    static async reset(dataDirectory: string): Promise<string[]> {
        const database = await Database.open(dataDirectory, new UuidGenerator());

        try {
            const report = await new ResetDevelopmentData(
                new KyselyLibraryEraser(database.connections),
                new KyselyCoverFileCleanup(
                    database.connections,
                    new FileCoverStorage(dataDirectory),
                ),
                database.connections,
            ).execute();

            return DevelopmentDataReport.reset(dataDirectory, report);
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
                    imports: LibraryModules.register(
                        {
                            database,
                            dataDirectory,
                            ids,
                            clock,
                            operations,
                        },
                        { developmentImport: true },
                    ),
                },
                { logger: false, abortOnError: false },
            );

            try {
                const lookup = { strict: false };

                console.log(DevelopmentDataReport.importing(source));
                const report = await new ImportV1Library(
                    new JsonV1Dump(source),
                    new CachedCoverDownloads(join(dirname(source), 'covers')),
                    IdentityModule.administrator(new KyselyUserRepository(database.connections)),
                    new KyselyLibraryEraser(database.connections),
                    new KyselyCoverFileCleanup(
                        database.connections,
                        new FileCoverStorage(dataDirectory),
                    ),
                    database.connections,
                    context.get<ImportBookUseCase>('BOOKS_IMPORT', lookup),
                    context.get<FinishCollectionUseCase>('COLLECTIONS_FINISH', lookup),
                ).execute();

                return DevelopmentDataReport.importV1(dataDirectory, report);
            } finally {
                await context.close();
            }
        } finally {
            await database.close();
        }
    }
}
