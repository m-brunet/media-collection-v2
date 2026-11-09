import type { AppearanceStore } from '../ports/driven/appearance-store.interface.js';
import { ColorScheme } from '../../domain/value-objects/color-scheme.value-object.js';
import type { IconSetStore } from '../ports/driven/icon-set-store.interface.js';
import { IconSet } from '../../domain/value-objects/icon-set.value-object.js';

export class MemoryAppearanceStore implements AppearanceStore {
    private scheme: ColorScheme | null = null;

    async read(): Promise<ColorScheme> {
        return this.scheme ?? ColorScheme.default;
    }

    async save(scheme: ColorScheme): Promise<void> {
        this.scheme = scheme;
    }
}

export class MemoryIconSetStore implements IconSetStore {
    private set: IconSet | null = null;

    async read(): Promise<IconSet> {
        return this.set ?? IconSet.default;
    }

    async save(set: IconSet): Promise<void> {
        this.set = set;
    }
}

export const administrator = {
    id: 'admin',
    username: 'admin',
    role: 'admin' as const,
    mustChangePassword: false,
    language: null,
};
