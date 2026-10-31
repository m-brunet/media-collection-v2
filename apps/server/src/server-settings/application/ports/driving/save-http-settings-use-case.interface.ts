import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { HttpSettingsState } from '../../../domain/value-objects/http-settings.value-object.js';

export interface SaveHttpSettingsUseCase {
    execute(actor: Actor, input: HttpSettingsState): Promise<HttpSettingsState>;
}
