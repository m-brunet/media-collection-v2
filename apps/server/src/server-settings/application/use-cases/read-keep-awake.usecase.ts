import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { KeepAwakeReader } from '../ports/driven/keep-awake-reader.interface.js';
import type { ReadKeepAwakeUseCase } from '../ports/driving/read-keep-awake-use-case.interface.js';

export class ReadKeepAwake implements ReadKeepAwakeUseCase {
    constructor(private readonly store: KeepAwakeReader) {}

    async execute(actor: Actor): Promise<boolean> {
        ActorAuthorization.requireAdmin(actor);

        return this.store.read();
    }
}
