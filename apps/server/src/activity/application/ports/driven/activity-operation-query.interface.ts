import type { ActivityCursor } from '../../activity-page.js';

export interface ActivityOperationQuery {
    categories: readonly string[];
    before: ActivityCursor | null;
    limit: number;
}
