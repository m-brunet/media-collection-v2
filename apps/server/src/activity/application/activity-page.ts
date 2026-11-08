import type { ActivityEntry } from '../domain/services/activity-projection.service.js';

// Where a page of Activity ends: the time and ID of its oldest operation.
export interface ActivityCursor {
    occurredAt: string;
    operationId: string;
}

// Entries newest first; `older` continues after the last one, null when nothing older exists.
export interface ActivityPage {
    entries: ActivityEntry[];
    older: ActivityCursor | null;
}
