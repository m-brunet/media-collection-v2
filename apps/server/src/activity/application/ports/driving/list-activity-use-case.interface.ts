import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ActivityCursor, ActivityPage } from '../../activity-page.js';

export interface ListActivityUseCase {
    // One page of shared Activity, newest first, continuing after `before` when given.
    execute(actor: Actor, before: ActivityCursor | null): Promise<ActivityPage>;
}
