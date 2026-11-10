import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { ActivityRecordReader } from '../../application/ports/driven/activity-record-reader.interface.js';
import { ListActivity } from '../../application/use-cases/list-activity.usecase.js';
import { ActivityController } from '../adapters/driving/web/activity.controller.js';

export interface ActivityDependencies {
    records: ActivityRecordReader;
}

const token = { records: 'ACTIVITY_RECORDS' } as const;

@Module({})
export class ActivityModule {
    static register(dependencies: ActivityDependencies): DynamicModule {
        return {
            module: ActivityModule,
            controllers: [ActivityController],
            providers: [
                { provide: token.records, useValue: dependencies.records },
                {
                    provide: 'ACTIVITY_LIST',
                    inject: [token.records],
                    useFactory: (records: ActivityRecordReader) => new ListActivity(records),
                },
            ],
        };
    }
}
