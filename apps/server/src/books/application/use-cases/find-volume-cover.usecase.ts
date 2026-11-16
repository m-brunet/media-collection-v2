import type {
    FindVolumeCoverUseCase,
    VolumeCover,
} from '../ports/driving/find-volume-cover-use-case.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import type { KeptCovers } from '../services/kept-covers.service.js';
import type { SourceLink } from '../services/source-chain.service.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FindVolumeCover implements FindVolumeCoverUseCase {
    constructor(
        private readonly covers: SourceLink<CoverOffer[]> | null,
        private readonly registry: LookupCoverRegistry,
        private readonly kept: KeptCovers,
    ) {}

    async execute(actor: Actor, isbn: string): Promise<VolumeCover> {
        ActorAuthorization.requireLibraryEditor(actor);
        const { isbn13 } = Isbn.parse(isbn);
        const offer =
            (await this.kept.offer(isbn13)) ?? (await this.covers?.first(isbn13, true))?.[0];

        return offer
            ? { kind: 'found', token: this.registry.register(offer.address) }
            : { kind: 'none' };
    }
}
