import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { OverviewView } from '../../overview-views.js';

export interface GetOverviewUseCase {
    // The shared counters and recently added books, and the viewer's own reading unless a Guest.
    execute(actor: Actor): Promise<OverviewView>;
}
