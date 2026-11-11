import type { IdGenerator } from '../../../../application/ports/driven/id-generator.interface.js';
import type { AuditEntry } from '../../../../application/ports/driven/audit-entry.interface.js';
import type { AuditTrail } from '../../../../application/ports/driven/audit-trail.interface.js';
import type { DatabaseConnections } from './database-connections.adapter.js';

export class KyselyAuditTrail implements AuditTrail {
    private static readonly secret = /password|hash|token|secret|private|key|chain|credential/i;

    constructor(
        private readonly connections: DatabaseConnections,
        private readonly ids: IdGenerator,
    ) {}

    async record(entry: AuditEntry): Promise<void> {
        await this.connections.current
            .insertInto('audit_logs')
            .values({
                id: this.ids.next(),
                operation_id: entry.operationId,
                category: entry.category,
                outcome: entry.outcome,
                actor_id: entry.actorId,
                occurred_at: entry.occurredAt,
                subject_type: entry.subjectType,
                subject_id: entry.subjectId,
                before_values: this.serialize(entry.before),
                after_values: this.serialize(entry.after),
                failure: entry.failure,
            })
            .execute();
    }

    private serialize(values: Record<string, unknown> | null): string | null {
        return values ? JSON.stringify(this.redact(values)) : null;
    }

    private redact(value: unknown): unknown {
        if (Array.isArray(value)) {
            return value.map((item) => this.redact(item));
        }

        if (value && typeof value === 'object') {
            return Object.fromEntries(
                Object.entries(value)
                    .filter(([key]) => !KyselyAuditTrail.secret.test(key))
                    .map(([key, item]) => [key, this.redact(item)]),
            );
        }

        return value;
    }
}
