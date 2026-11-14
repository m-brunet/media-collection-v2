import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { TlsSettingsState } from '../../../domain/value-objects/tls-settings.value-object.js';

export interface SaveHttpsPortUseCase {
    execute(actor: Actor, input: { port: number }): Promise<TlsSettingsState>;
}
