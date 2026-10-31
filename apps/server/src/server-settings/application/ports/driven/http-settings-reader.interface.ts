import type { HttpSettings } from '../../../domain/value-objects/http-settings.value-object.js';

export interface HttpSettingsReader {
    read(): Promise<HttpSettings>;
}
