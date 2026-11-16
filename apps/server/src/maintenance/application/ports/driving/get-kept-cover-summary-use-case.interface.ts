import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { KeptCoverSummary } from '../driven/kept-cover-archive.interface.js';

export interface GetKeptCoverSummaryUseCase {
    execute(actor: Actor): Promise<KeptCoverSummary>;
}
