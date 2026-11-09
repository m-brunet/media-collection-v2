import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { AppearanceStore } from '../../application/ports/driven/appearance-store.interface.js';
import type { IconSetStore } from '../../application/ports/driven/icon-set-store.interface.js';
import { ReadAppearance } from '../../application/use-cases/read-appearance.usecase.js';
import { SaveAppearance } from '../../application/use-cases/save-appearance.usecase.js';
import { SaveIconSet } from '../../application/use-cases/save-icon-set.usecase.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { AppearanceController } from '../adapters/driving/web/appearance.controller.js';

export const APPEARANCE_STORE = 'APPEARANCE_STORE';
export const APPEARANCE_AUDITED_OPERATION = 'APPEARANCE_AUDITED_OPERATION';
export const APPEARANCE_READ = 'APPEARANCE_READ';
export const APPEARANCE_SAVE = 'APPEARANCE_SAVE';
export const APPEARANCE_ICON_SET_STORE = 'APPEARANCE_ICON_SET_STORE';
export const APPEARANCE_SAVE_ICON_SET = 'APPEARANCE_SAVE_ICON_SET';

@Module({})
export class AppearanceModule {
    static register(
        store: AppearanceStore,
        iconSets: IconSetStore,
        operations: AuditedOperation,
    ): DynamicModule {
        return {
            module: AppearanceModule,
            controllers: [AppearanceController],
            providers: [
                { provide: APPEARANCE_STORE, useValue: store },
                { provide: APPEARANCE_AUDITED_OPERATION, useValue: operations },
                { provide: APPEARANCE_ICON_SET_STORE, useValue: iconSets },
                {
                    provide: APPEARANCE_READ,
                    inject: [APPEARANCE_STORE, APPEARANCE_ICON_SET_STORE],
                    useFactory: (appearance: AppearanceStore, sets: IconSetStore) =>
                        new ReadAppearance(appearance, sets),
                },
                {
                    provide: APPEARANCE_SAVE_ICON_SET,
                    inject: [APPEARANCE_ICON_SET_STORE, APPEARANCE_AUDITED_OPERATION],
                    useFactory: (sets: IconSetStore, audited: AuditedOperation) =>
                        new SaveIconSet(sets, audited),
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
