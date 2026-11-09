import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import type { DomainNameReader } from '../ports/driven/domain-name-reader.interface.js';
import type { ReadDomainNameUseCase } from '../ports/driving/read-domain-name-use-case.interface.js';

export class ReadDomainName implements ReadDomainNameUseCase {
    constructor(private readonly store: DomainNameReader) {}

    async execute(actor: Actor): Promise<string | null> {
        ActorAuthorization.requireAdmin(actor);

        return this.store.read();
    }
}
