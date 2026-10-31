import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { TlsSettingsState } from '../../../domain/value-objects/tls-settings.value-object.js';

export interface SaveTlsSettingsUseCase {
    execute(
        actor: Actor,
        input: { enabled: boolean; port: number; chain?: string; key?: string },
    ): Promise<TlsSettingsState>;
}
