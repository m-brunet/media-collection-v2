import type {
    FindVolumeCoverUseCase,
    VolumeCover,
} from '../ports/driving/find-volume-cover-use-case.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import type { SourceLink } from '../services/source-chain.service.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FindVolumeCover implements FindVolumeCoverUseCase {
    constructor(
        private readonly covers: SourceLink<CoverOffer[]> | null,
        private readonly registry: LookupCoverRegistry,
    ) {}

    async execute(actor: Actor, isbn: string): Promise<VolumeCover> {
        ActorAuthorization.requireLibraryEditor(actor);
        const { isbn13 } = Isbn.parse(isbn);
        const reply = await this.covers?.request(isbn13, true);
        const offer = reply && reply !== 'failed' && reply.kind === 'found' ? reply.value[0] : null;

        return offer
            ? { kind: 'found', token: this.registry.register(offer.address) }
            : { kind: 'none' };
    }
}
