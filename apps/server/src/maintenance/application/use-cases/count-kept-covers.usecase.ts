import type { CountKeptCoversUseCase } from '../ports/driving/count-kept-covers-use-case.interface.js';
import type { KeptCoverCount } from '../ports/driven/kept-cover-count.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class CountKeptCovers implements CountKeptCoversUseCase {
    constructor(private readonly covers: KeptCoverCount) {}

    async execute(actor: Actor): Promise<number> {
        ActorAuthorization.requireAdmin(actor);

        return this.covers.afterReset();
    }
}
