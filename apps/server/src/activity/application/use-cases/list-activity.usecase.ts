import type { ActivityCursor, ActivityPage } from '../activity-page.js';
import type { ActivityRecordReader } from '../ports/driven/activity-record-reader.interface.js';
import type { ListActivityUseCase } from '../ports/driving/list-activity-use-case.interface.js';
import { ActivityEligibility } from '../../domain/services/activity-eligibility.service.js';
import type { ActivityOperation } from '../../domain/services/activity-projection.service.js';
import { ActivityTimeline } from '../../domain/services/activity-timeline.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// A page holds whole operations, so a lending is never split across pages; operations that give
// no entry (for example a cover change joined to the save before it) do not count toward the
// page size.
export class ListActivity implements ListActivityUseCase {
    static readonly pageSize = 20;

    constructor(private readonly records: ActivityRecordReader) {}

    async execute(actor: Actor, before: ActivityCursor | null): Promise<ActivityPage> {
        ActorAuthorization.requireReady(actor);
        const limit = ListActivity.pageSize + 1;
        const operations: ActivityOperation[] = [];
        let cursor = before;

        for (;;) {
            const batch = await this.records.operations({
                categories: ActivityEligibility.categories,
                before: cursor,
                limit,
            });

            operations.push(...batch);
            const entries = ActivityTimeline.of(operations);
            const last = batch.at(-1);

            if (batch.length < limit || entries.length > ListActivity.pageSize || !last) {
                return this.page(entries);
            }

            cursor = { occurredAt: last.occurredAt, operationId: last.id };
        }
    }

    private page(entries: ActivityPage['entries']): ActivityPage {
        const shown = entries.slice(0, ListActivity.pageSize);
        const last = shown.at(-1);

        return {
            entries: shown,
            older:
                entries.length > ListActivity.pageSize && last
                    ? { occurredAt: last.occurredAt, operationId: last.id }
                    : null,
        };
    }
}
