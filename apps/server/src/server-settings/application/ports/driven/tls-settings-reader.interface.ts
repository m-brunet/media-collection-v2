import type { TlsSettingsState } from '../../../domain/value-objects/tls-settings.value-object.js';

export interface TlsSettingsReader {
    read(): Promise<TlsSettingsState>;
}
