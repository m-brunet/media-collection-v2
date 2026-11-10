import type { OverviewView } from '../overview-views.js';
import type { LibrarySummaryReader } from '../ports/driven/library-summary-reader.interface.js';
import type { GetOverviewUseCase } from '../ports/driving/get-overview-use-case.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetOverview implements GetOverviewUseCase {
    static readonly recentCount = 5;

    constructor(private readonly summary: LibrarySummaryReader) {}

    async execute(actor: Actor): Promise<OverviewView> {
        ActorAuthorization.requireReady(actor);
        const personal = actor.role !== 'guest';
        const recent = await this.summary.recentlyAdded(GetOverview.recentCount, actor.id);

        return {
            ...(await this.summary.counts()),
            recentlyAdded: recent.map((book) => ({ ...book, read: personal ? book.read : null })),
            reading: personal ? await this.summary.reading(actor.id) : null,
            bookcaseList: await this.summary.bookcases(),
        };
    }
}
