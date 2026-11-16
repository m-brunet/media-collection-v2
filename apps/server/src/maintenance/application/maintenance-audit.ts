import type { AuditOutcome } from '../../shared/application/ports/driven/audit-entry.interface.js';

export const MaintenanceAudit = {
    backupCreated: 'maintenance.backup-created',
    backupRestored: 'maintenance.backup-restored',
    dataReset: 'maintenance.data-reset',
    keptCoversDeleted: 'maintenance.kept-covers-deleted',
} as const;

export interface MaintenanceRecord {
    category: string;
    outcome: AuditOutcome;
    details: Record<string, unknown> | null;
    error: unknown;
}
