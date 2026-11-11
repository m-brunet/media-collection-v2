import type { AuditEntry } from '../ports/driven/audit-entry.interface.js';
import type { AuditTrail } from '../ports/driven/audit-trail.interface.js';
import type { TransactionRunner } from '../ports/driven/transaction-runner.interface.js';
import { AuditedOperation } from '../services/audited-operation.service.js';

export class MemoryAuditTrail implements AuditTrail, TransactionRunner {
    readonly entries: AuditEntry[] = [];
    private pending: AuditEntry[] | null = null;

    async record(entry: AuditEntry): Promise<void> {
        (this.pending ?? this.entries).push(structuredClone(entry));
    }

    async run<T>(work: () => Promise<T>): Promise<T> {
        if (this.pending) {
            return work();
        }

        this.pending = [];

        try {
            const result = await work();

            this.entries.push(...this.pending);

            return result;
        } finally {
            this.pending = null;
        }
    }
}

export class AuditDoubles {
    static auditedOperation(trail: MemoryAuditTrail): AuditedOperation {
        let counter = 0;

        return new AuditedOperation(
            trail,
            trail,
            { now: () => new Date('2026-01-01T00:00:00Z') },
            { next: () => 'operation-' + ++counter },
        );
    }
}
