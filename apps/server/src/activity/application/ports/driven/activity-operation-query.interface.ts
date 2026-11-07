import type { ActivityCursor } from '../../activity-page.js';

export interface ActivityOperationQuery {
    categories: readonly string[];
    // Only operations older than this one; null starts with the newest.
    before: ActivityCursor | null;
    limit: number;
}
