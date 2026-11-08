import type { MaintenanceRecord } from '../../maintenance-audit.js';

// Writes a maintenance audit record in the current application data, without an acting account.
export interface MaintenanceJournal {
    record(record: MaintenanceRecord): Promise<void>;
}
