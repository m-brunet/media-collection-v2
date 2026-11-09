import type { ReadAppearanceUseCase } from '../ports/driving/read-appearance-use-case.interface.js';
import type { AppearanceStore } from '../ports/driven/appearance-store.interface.js';
import type { IconSetReader } from '../ports/driven/icon-set-reader.interface.js';
import type { ColorSchemeName } from '../../domain/value-objects/color-scheme.value-object.js';
import type { IconSetName } from '../../domain/value-objects/icon-set.value-object.js';

export class ReadAppearance implements ReadAppearanceUseCase {
    constructor(
        private readonly store: AppearanceStore,
        private readonly iconSets: IconSetReader,
    ) {}

    async execute(): Promise<{ colorScheme: ColorSchemeName; iconSet: IconSetName }> {
        return {
            colorScheme: (await this.store.read()).name,
            iconSet: (await this.iconSets.read()).name,
        };
    }
}
