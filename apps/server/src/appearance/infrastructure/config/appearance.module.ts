import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { AppearanceStore } from '../../application/ports/driven/appearance-store.interface.js';
import { ReadAppearance } from '../../application/use-cases/read-appearance.usecase.js';
import { SaveAppearance } from '../../application/use-cases/save-appearance.usecase.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { AppearanceController } from '../adapters/driving/web/appearance.controller.js';

export const APPEARANCE_STORE = 'APPEARANCE_STORE';
export const APPEARANCE_AUDITED_OPERATION = 'APPEARANCE_AUDITED_OPERATION';
export const APPEARANCE_READ = 'APPEARANCE_READ';
export const APPEARANCE_SAVE = 'APPEARANCE_SAVE';

@Module({})
export class AppearanceModule {
    static register(store: AppearanceStore, operations: AuditedOperation): DynamicModule {
        return {
            module: AppearanceModule,
            controllers: [AppearanceController],
            providers: [
                { provide: APPEARANCE_STORE, useValue: store },
                { provide: APPEARANCE_AUDITED_OPERATION, useValue: operations },
                {
                    provide: APPEARANCE_READ,
                    inject: [APPEARANCE_STORE],
                    useFactory: (appearance: AppearanceStore) => new ReadAppearance(appearance),
                },
                {
                    provide: APPEARANCE_SAVE,
                    inject: [APPEARANCE_STORE, APPEARANCE_AUDITED_OPERATION],
                    useFactory: (appearance: AppearanceStore, audited: AuditedOperation) =>
                        new SaveAppearance(appearance, audited),
                },
            ],
        };
    }
}
