import type { TlsSettingsReader } from './tls-settings-reader.interface.js';
import type { TlsSettings } from '../../../domain/value-objects/tls-settings.value-object.js';

export interface TlsStore extends TlsSettingsReader {
    save(settings: TlsSettings, certificate?: { chain: string; key: string }): Promise<void>;
}
