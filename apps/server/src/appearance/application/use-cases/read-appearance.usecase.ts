import type { ReadAppearanceUseCase } from '../ports/driving/read-appearance-use-case.interface.js';
import type { AppearanceStore } from '../ports/driven/appearance-store.interface.js';
import type { ColorSchemeName } from '../../domain/value-objects/color-scheme.value-object.js';

export class ReadAppearance implements ReadAppearanceUseCase {
    constructor(private readonly store: AppearanceStore) {}

    async execute(): Promise<{ colorScheme: ColorSchemeName }> {
        return { colorScheme: (await this.store.read()).name };
    }
}
