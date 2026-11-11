import type { ActivityEntry } from '../domain/services/activity-projection.service.js';

export interface ActivityCursor {
    occurredAt: string;
    operationId: string;
}

export interface ActivityPage {
    entries: ActivityEntry[];
    older: ActivityCursor | null;
}
