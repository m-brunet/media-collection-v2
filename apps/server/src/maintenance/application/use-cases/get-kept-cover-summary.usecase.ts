import type { GetKeptCoverSummaryUseCase } from '../ports/driving/get-kept-cover-summary-use-case.interface.js';
import type {
    KeptCoverArchive,
    KeptCoverSummary,
} from '../ports/driven/kept-cover-archive.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetKeptCoverSummary implements GetKeptCoverSummaryUseCase {
    constructor(private readonly archive: KeptCoverArchive) {}

    async execute(actor: Actor): Promise<KeptCoverSummary> {
        ActorAuthorization.requireAdmin(actor);

        return this.archive.summary();
    }
}
