import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { AdministratorPasswordCheck } from '../../application/ports/driven/administrator-password-check.interface.js';
import type { ApplicationDataEraser } from '../../application/ports/driven/application-data-eraser.interface.js';
import type { CoverFileCleanup } from '../../application/ports/driven/cover-file-cleanup.interface.js';
import { ResetApplicationData } from '../../application/use-cases/reset-application-data.usecase.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { HttpSessions } from '../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';
import { MaintenanceController } from '../adapters/driving/web/maintenance.controller.js';

export const MAINTENANCE_PASSWORD_CHECK = 'MAINTENANCE_PASSWORD_CHECK';
export const MAINTENANCE_DATA_ERASER = 'MAINTENANCE_DATA_ERASER';
export const MAINTENANCE_COVER_CLEANUP = 'MAINTENANCE_COVER_CLEANUP';
export const MAINTENANCE_AUDITED_OPERATION = 'MAINTENANCE_AUDITED_OPERATION';
export const MAINTENANCE_RESET_DATA = 'MAINTENANCE_RESET_DATA';

export interface MaintenanceDependencies {
    passwords: AdministratorPasswordCheck;
    eraser: ApplicationDataEraser;
    covers: CoverFileCleanup;
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
