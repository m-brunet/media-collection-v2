import type { HttpSettingsReader } from './http-settings-reader.interface.js';
import type { HttpSettings } from '../../../domain/value-objects/http-settings.value-object.js';

export interface HttpSettingsStore extends HttpSettingsReader {
    save(settings: HttpSettings): Promise<void>;
}
