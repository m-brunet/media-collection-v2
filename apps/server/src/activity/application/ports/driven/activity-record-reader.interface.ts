import type { ActivityOperationQuery } from './activity-operation-query.interface.js';
import type { ActivityOperation } from '../../../domain/services/activity-projection.service.js';

export interface ActivityRecordReader {
    // Operations with Successful records in the given categories, newest first (by time, then
    // ID), each with only those records and its acting account's current username.
    operations(query: ActivityOperationQuery): Promise<ActivityOperation[]>;
}
