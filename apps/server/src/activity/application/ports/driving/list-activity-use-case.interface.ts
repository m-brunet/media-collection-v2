import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ActivityCursor, ActivityPage } from '../../activity-page.js';

export interface ListActivityUseCase {
    execute(actor: Actor, before: ActivityCursor | null): Promise<ActivityPage>;
}
