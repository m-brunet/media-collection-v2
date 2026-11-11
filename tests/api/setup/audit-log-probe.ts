import { sql } from 'kysely';
import type { Database } from '../../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';

export interface AuditLogRecord {
    operationId: string;
    category: string;
    outcome: string;
    actorId: string | null;
    subjectType: string;
    subjectId: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    failure: string | null;
}

export class AuditLogProbe {
    constructor(private readonly database: Database) {}

    async entries(): Promise<AuditLogRecord[]> {
        const rows = await this.database.connection
            .selectFrom('audit_logs')
            .selectAll()
            .orderBy(sql`rowid`)
            .execute();

        return rows.map((row) => ({
            operationId: row.operation_id,
            category: row.category,
            outcome: row.outcome,
            actorId: row.actor_id,
            subjectType: row.subject_type,
            subjectId: row.subject_id,
            before: row.before_values ? JSON.parse(row.before_values) : null,
            after: row.after_values ? JSON.parse(row.after_values) : null,
            failure: row.failure,
        }));
    }

    async text(): Promise<string> {
        return JSON.stringify(
            await this.database.connection.selectFrom('audit_logs').selectAll().execute(),
        );
    }
}
