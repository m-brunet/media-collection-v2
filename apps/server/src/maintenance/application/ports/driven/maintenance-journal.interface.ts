import type { MaintenanceRecord } from '../../maintenance-audit.js';

export interface MaintenanceJournal {
    record(record: MaintenanceRecord): Promise<void>;
}
