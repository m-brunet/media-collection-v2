import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { AdministratorPasswordCheck } from '../../application/ports/driven/administrator-password-check.interface.js';
import type { ApplicationDataEraser } from '../../application/ports/driven/application-data-eraser.interface.js';
import type { CoverFileCleanup } from '../../application/ports/driven/cover-file-cleanup.interface.js';
import type { KeptCoverArchive } from '../../application/ports/driven/kept-cover-archive.interface.js';
import type { KeptCoverCount } from '../../application/ports/driven/kept-cover-count.interface.js';
import { DeleteKeptCovers } from '../../application/use-cases/delete-kept-covers.usecase.js';
import { GetKeptCoverSummary } from '../../application/use-cases/get-kept-cover-summary.usecase.js';
import { CountKeptCovers } from '../../application/use-cases/count-kept-covers.usecase.js';
import { ResetApplicationData } from '../../application/use-cases/reset-application-data.usecase.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { HttpSessions } from '../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { MaintenanceController } from '../adapters/driving/web/maintenance.controller.js';

export const MAINTENANCE_PASSWORD_CHECK = 'MAINTENANCE_PASSWORD_CHECK';
export const MAINTENANCE_DATA_ERASER = 'MAINTENANCE_DATA_ERASER';
export const MAINTENANCE_COVER_CLEANUP = 'MAINTENANCE_COVER_CLEANUP';
export const MAINTENANCE_AUDITED_OPERATION = 'MAINTENANCE_AUDITED_OPERATION';
export const MAINTENANCE_RESET_DATA = 'MAINTENANCE_RESET_DATA';
export const MAINTENANCE_KEPT_COVER_COUNT = 'MAINTENANCE_KEPT_COVER_COUNT';
export const MAINTENANCE_COUNT_KEPT_COVERS = 'MAINTENANCE_COUNT_KEPT_COVERS';
export const MAINTENANCE_KEPT_COVER_ARCHIVE = 'MAINTENANCE_KEPT_COVER_ARCHIVE';
export const MAINTENANCE_GET_KEPT_COVER_SUMMARY = 'MAINTENANCE_GET_KEPT_COVER_SUMMARY';
export const MAINTENANCE_DELETE_KEPT_COVERS = 'MAINTENANCE_DELETE_KEPT_COVERS';

export interface MaintenanceDependencies {
    passwords: AdministratorPasswordCheck;
    eraser: ApplicationDataEraser;
    covers: CoverFileCleanup;
    keptCovers: KeptCoverCount;
    keptCoverArchive: KeptCoverArchive;
    operations: AuditedOperation;
    sessions: HttpSessions;
}

@Module({})
export class MaintenanceModule {
    static register(dependencies: MaintenanceDependencies): DynamicModule {
        return {
            module: MaintenanceModule,
            controllers: [MaintenanceController],
            providers: [
                { provide: MAINTENANCE_PASSWORD_CHECK, useValue: dependencies.passwords },
                { provide: MAINTENANCE_DATA_ERASER, useValue: dependencies.eraser },
                { provide: MAINTENANCE_COVER_CLEANUP, useValue: dependencies.covers },
                { provide: MAINTENANCE_AUDITED_OPERATION, useValue: dependencies.operations },
                { provide: MAINTENANCE_KEPT_COVER_COUNT, useValue: dependencies.keptCovers },
                {
                    provide: MAINTENANCE_KEPT_COVER_ARCHIVE,
                    useValue: dependencies.keptCoverArchive,
                },
                {
                    provide: MAINTENANCE_GET_KEPT_COVER_SUMMARY,
                    inject: [MAINTENANCE_KEPT_COVER_ARCHIVE],
                    useFactory: (archive: KeptCoverArchive) => new GetKeptCoverSummary(archive),
                },
                {
                    provide: MAINTENANCE_DELETE_KEPT_COVERS,
                    inject: [
                        MAINTENANCE_KEPT_COVER_ARCHIVE,
                        MAINTENANCE_COVER_CLEANUP,
                        MAINTENANCE_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        archive: KeptCoverArchive,
                        covers: CoverFileCleanup,
                        operations: AuditedOperation,
                    ) => new DeleteKeptCovers(archive, covers, operations),
                },
                {
                    provide: MAINTENANCE_COUNT_KEPT_COVERS,
                    inject: [MAINTENANCE_KEPT_COVER_COUNT],
                    useFactory: (covers: KeptCoverCount) => new CountKeptCovers(covers),
                },
                { provide: HttpSessions, useValue: dependencies.sessions },
                {
                    provide: MAINTENANCE_RESET_DATA,
                    inject: [
                        MAINTENANCE_PASSWORD_CHECK,
                        MAINTENANCE_DATA_ERASER,
                        MAINTENANCE_COVER_CLEANUP,
                        MAINTENANCE_AUDITED_OPERATION,
                    ],
                    useFactory: (
                        passwords: AdministratorPasswordCheck,
                        eraser: ApplicationDataEraser,
                        covers: CoverFileCleanup,
                        operations: AuditedOperation,
                    ) => new ResetApplicationData(passwords, eraser, covers, operations),
                },
            ],
        };
    }
}
