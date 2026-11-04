import type { AuditEntry } from './audit-entry.interface.js';

export interface AuditTrail {
    record(entry: AuditEntry): Promise<void>;
}
