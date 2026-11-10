import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { OverviewView } from '../../overview-views.js';

export interface GetOverviewUseCase {
    execute(actor: Actor): Promise<OverviewView>;
}
