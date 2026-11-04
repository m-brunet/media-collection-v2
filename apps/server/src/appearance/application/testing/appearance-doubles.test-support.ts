import type { AppearanceStore } from '../ports/driven/appearance-store.interface.js';
import { ColorScheme } from '../../domain/value-objects/color-scheme.value-object.js';

export class MemoryAppearanceStore implements AppearanceStore {
    private scheme: ColorScheme | null = null;

    async read(): Promise<ColorScheme> {
        return this.scheme ?? ColorScheme.default;
    }

    async save(scheme: ColorScheme): Promise<void> {
        this.scheme = scheme;
    }
}

export const administrator = {
    id: 'admin',
    username: 'admin',
    role: 'admin' as const,
    mustChangePassword: false,
    language: null,
};
