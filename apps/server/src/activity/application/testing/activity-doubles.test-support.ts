import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import type {
    ActivityOperation,
    ActivityRecord,
} from '../../domain/services/activity-projection.service.js';
import type { ActivityOperationQuery } from '../ports/driven/activity-operation-query.interface.js';
import type { ActivityRecordReader } from '../ports/driven/activity-record-reader.interface.js';

export class ActivityActors {
    static readonly owner = TestActors.of('owner', 'camille');
    static readonly guest = TestActors.of('guest', 'morgan');
    static readonly administrator = TestActors.of('admin', 'alex');
    static readonly temporaryOwner = TestActors.of('owner', 'sam', true);
}

export class InMemoryActivityRecords implements ActivityRecordReader {
    readonly queries: ActivityOperationQuery[] = [];

    constructor(readonly stored: ActivityOperation[] = []) {}

    async operations(query: ActivityOperationQuery): Promise<ActivityOperation[]> {
        this.queries.push(query);

        return this.stored
            .map((operation) => ({
                ...operation,
                records: operation.records.filter((record) =>
                    query.categories.includes(record.category),
                ),
            }))
            .filter((operation) => operation.records.length > 0)
            .filter(
                (operation) =>
                    !query.before ||
                    operation.occurredAt < query.before.occurredAt ||
                    (operation.occurredAt === query.before.occurredAt &&
                        operation.id < query.before.operationId),
            )
            .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))
            .slice(0, query.limit);
    }
}

export class ActivityOperations {
    static at(
        minutes: number,
        category: string,
        after: Record<string, unknown>,
        overrides: Partial<ActivityOperation> = {},
    ): ActivityOperation {
        const record: ActivityRecord = {
            category,
            subjectId: 'subject-' + minutes,
            before: null,
            after,
            currentTitle: null,
        };

        return {
            id: 'operation-' + String(minutes).padStart(4, '0'),
            occurredAt: new Date(Date.UTC(2026, 10, 1, 10, minutes)).toISOString(),
            actorId: 'user-alex',
            actor: 'Alex',
            records: [record],
            ...overrides,
        };
    }

    static additions(count: number, from = 0): ActivityOperation[] {
        return Array.from({ length: count }, (_, index) =>
            ActivityOperations.at(from + index, 'book.created', {
                title: 'Book ' + (from + index),
            }),
        );
    }
}
