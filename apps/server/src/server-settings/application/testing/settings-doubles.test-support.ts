import type { TlsStore } from '../ports/driven/tls-store.interface.js';
import type { TlsSettingsState } from '../../domain/value-objects/tls-settings.value-object.js';
import type { HttpSettingsStore } from '../ports/driven/http-settings-store.interface.js';
import type { HttpSettingsState } from '../../domain/value-objects/http-settings.value-object.js';
import { HttpSettings } from '../../domain/value-objects/http-settings.value-object.js';

export const actor = {
    id: 'admin',
    username: 'admin',
    role: 'admin' as const,
    mustChangePassword: false,
};

export function setup(
    initial: TlsSettingsState = { enabled: false, port: 3443, hasCertificate: false },
    initialHttp: HttpSettingsState = { port: 3000 },
) {
    let settings = { ...initial };
    let validations = 0;
    let httpSettings = { ...initialHttp };
    const http: HttpSettingsStore = {
        read: async () => new HttpSettings(httpSettings.port),
        save: async (value) => {
            httpSettings = value.snapshot();
        },
    };
    const store: TlsStore = {
        read: async () => ({ ...settings }),
        save: async (value) => {
            settings = value.snapshot();
        },
    };
    const validator = {
        validate: (chain: string, key: string) => {
            validations++;

            if (chain !== 'certificate' || key !== 'private') {
                throw new Error('Invalid pair');
            }
        },
    };

    return { store, http, validator, validations: () => validations };
}
