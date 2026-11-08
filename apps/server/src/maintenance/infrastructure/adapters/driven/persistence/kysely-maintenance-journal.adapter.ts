import type { MaintenanceJournal } from '../../../../application/ports/driven/maintenance-journal.interface.js';
import type { MaintenanceRecord } from '../../../../application/maintenance-audit.js';
import type { Clock } from '../../../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../../../shared/application/ports/driven/id-generator.interface.js';
import { KyselyAuditTrail } from '../../../../../shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { DatabaseSession } from './database-session.adapter.js';

export class KyselyMaintenanceJournal implements MaintenanceJournal {
    constructor(
        private readonly session: DatabaseSession,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    record(record: MaintenanceRecord): Promise<void> {
        return this.session.use((connections) =>
            new KyselyAuditTrail(connections, this.ids).record({
                operationId: this.ids.next(),
                category: record.category,
                outcome: record.outcome,
                actorId: null,
                occurredAt: this.clock.now().toISOString(),
                subjectType: 'installation',
                subjectId: null,
                before: null,
                after: record.outcome === 'successful' ? record.details : null,
                failure: record.outcome === 'failed' ? Failure.auditCode(record.error) : null,
            }),
        );
    }
}
