import type { ActivityOperationQuery } from '../../../../application/ports/driven/activity-operation-query.interface.js';
import type { ActivityRecordReader } from '../../../../application/ports/driven/activity-record-reader.interface.js';
import type {
    ActivityOperation,
    ActivityRecord,
} from '../../../../domain/services/activity-projection.service.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Reads Successful audit records grouped by operation, with the acting account's current
// username (renamed and deactivated accounts keep being named) and, for records about a book,
// the book's current title.
export class KyselyActivityRecordReader implements ActivityRecordReader {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async operations(query: ActivityOperationQuery): Promise<ActivityOperation[]> {
        if (query.categories.length === 0 || query.limit <= 0) {
            return [];
        }

        const operations = await this.page(query);

        if (operations.length === 0) {
            return [];
        }

        const rows = await this.db
            .selectFrom('audit_logs')
            .leftJoin('users', 'users.id', 'audit_logs.actor_id')
            .leftJoin('books', (join) =>
                join
                    .onRef('books.id', '=', 'audit_logs.subject_id')
                    .on('audit_logs.subject_type', '=', 'book'),
            )
            .select([
                'audit_logs.operation_id',
                'audit_logs.category',
                'audit_logs.actor_id',
                'audit_logs.subject_id',
                'audit_logs.before_values',
                'audit_logs.after_values',
                'users.username',
                'books.title',
            ])
            .where(
                'audit_logs.operation_id',
                'in',
                operations.map((operation) => operation.operation_id),
            )
            .where('audit_logs.outcome', '=', 'successful')
            .where('audit_logs.category', 'in', [...query.categories])
            .execute();

        return operations.map((operation) => {
            const records = rows.filter((row) => row.operation_id === operation.operation_id);
            const first = records[0];

            return {
                id: operation.operation_id,
                occurredAt: operation.occurred_at,
                actorId: first?.actor_id ?? null,
                actor: first?.username ?? null,
                records: records.map((row): ActivityRecord => ({
                    category: row.category,
                    subjectId: row.subject_id,
                    before: this.parse(row.before_values),
                    after: this.parse(row.after_values),
                    currentTitle: row.title,
                })),
            };
        });
    }

    // The operations of the page, by the time of their first record, then by ID.
    private async page(query: ActivityOperationQuery) {
        const before = query.before;
        let operations = this.db
            .selectFrom('audit_logs')
            .select((eb) => ['operation_id', eb.fn.min<string>('occurred_at').as('occurred_at')])
            .where('outcome', '=', 'successful')
            .where('category', 'in', [...query.categories])
            .groupBy('operation_id');

        if (before) {
            operations = operations.having((eb) =>
                eb.or([
                    eb(eb.fn.min('occurred_at'), '<', before.occurredAt),
                    eb.and([
                        eb(eb.fn.min('occurred_at'), '=', before.occurredAt),
                        eb('operation_id', '<', before.operationId),
                    ]),
                ]),
            );
        }

        return operations
            .orderBy('occurred_at', 'desc')
            .orderBy('operation_id', 'desc')
            .limit(query.limit)
            .execute();
    }

    private parse(values: string | null): Record<string, unknown> | null {
        if (!values) {
            return null;
        }

        const parsed: unknown = JSON.parse(values);

        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    }
}
