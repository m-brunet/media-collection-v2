import type { TlsSettingsState } from '../../../domain/value-objects/tls-settings.value-object.js';

export interface TlsSettingsReader {
    // Preserve saved values for inspection and correction, including older invalid configurations.
    read(): Promise<TlsSettingsState>;
}
