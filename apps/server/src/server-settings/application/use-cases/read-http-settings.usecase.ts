import type { ReadHttpSettingsUseCase } from '../ports/driving/read-http-settings-use-case.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { HttpSettingsState } from '../../domain/value-objects/http-settings.value-object.js';
import type { HttpSettingsReader } from '../ports/driven/http-settings-reader.interface.js';

export class ReadHttpSettings implements ReadHttpSettingsUseCase {
    constructor(private readonly store: HttpSettingsReader) {}

    execute(actor: Actor): Promise<HttpSettingsState> {
        ActorAuthorization.requireAdmin(actor);

        return this.store.read().then((settings) => settings.snapshot());
    }
}
