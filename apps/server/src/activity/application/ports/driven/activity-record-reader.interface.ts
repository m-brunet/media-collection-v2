import type { ActivityOperationQuery } from './activity-operation-query.interface.js';
import type { ActivityOperation } from '../../../domain/services/activity-projection.service.js';

export interface ActivityRecordReader {
    operations(query: ActivityOperationQuery): Promise<ActivityOperation[]>;
}
