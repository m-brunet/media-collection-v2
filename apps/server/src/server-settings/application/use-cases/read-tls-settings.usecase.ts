import type { ReadTlsSettingsUseCase } from '../ports/driving/read-tls-settings-use-case.interface.js';
import type { TlsSettingsState } from '../../domain/value-objects/tls-settings.value-object.js';
import type { TlsSettingsReader } from '../ports/driven/tls-settings-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ReadTlsSettings implements ReadTlsSettingsUseCase {
    constructor(private readonly store: TlsSettingsReader) {}

    execute(actor: Actor): Promise<TlsSettingsState> {
        ActorAuthorization.requireAdmin(actor);

        return this.store.read();
    }
}
