import type {
    FindVolumeCoverUseCase,
    VolumeCover,
} from '../ports/driving/find-volume-cover-use-case.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import { SourceBudget } from '../services/source-budget.service.js';
import type { SourceLink } from '../services/source-chain.service.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export type CoverPace = { requests: number; seconds: number };

export class FindVolumeCover implements FindVolumeCoverUseCase {
    private readonly pace: SourceBudget;

    constructor(
        private readonly covers: SourceLink<CoverOffer[]> | null,
        private readonly registry: LookupCoverRegistry,
        private readonly clock: Clock,
        private readonly limit: CoverPace,
    ) {
        this.pace = new SourceBudget(limit, clock);
    }

    static half(limit: CoverPace): CoverPace {
        return { requests: Math.max(1, Math.floor(limit.requests / 2)), seconds: limit.seconds };
    }

    async execute(actor: Actor, isbn: string): Promise<VolumeCover> {
        ActorAuthorization.requireLibraryEditor(actor);
        const { isbn13 } = Isbn.parse(isbn);

        if (!this.covers) {
            return { kind: 'none' };
        }

        if (!this.pace.take()) {
            return { kind: 'limited', retryAt: this.later(null) };
        }

        const reply = await this.covers.request(isbn13);

        if (reply === 'failed' || reply.kind === 'none') {
            return { kind: 'none' };
        }

        if (reply.kind === 'limited') {
            return { kind: 'limited', retryAt: this.later(reply.retryAt) };
        }

        const offer = reply.value[0];

        return offer
            ? { kind: 'found', token: this.registry.register(offer.address) }
            : { kind: 'none' };
    }

    private later(retryAt: Date | null): string {
        const interval = (this.limit.seconds / this.limit.requests) * 1000;

        return (retryAt ?? new Date(this.clock.now().getTime() + interval)).toISOString();
    }
}
