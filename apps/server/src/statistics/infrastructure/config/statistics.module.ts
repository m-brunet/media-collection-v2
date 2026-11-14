import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { CollectionTallies } from '../../application/ports/driven/collection-tallies.interface.js';
import type { LibraryStatisticsReader } from '../../application/ports/driven/library-statistics-reader.interface.js';
import { GetStatistics } from '../../application/use-cases/get-statistics.usecase.js';
import { StatisticsController } from '../adapters/driving/web/statistics.controller.js';

export interface StatisticsDependencies {
    library: LibraryStatisticsReader;
    collections: CollectionTallies;
}

const token = {
    library: 'STATISTICS_LIBRARY',
    collections: 'STATISTICS_COLLECTIONS',
} as const;

@Module({})
export class StatisticsModule {
    static register(dependencies: StatisticsDependencies): DynamicModule {
        return {
            module: StatisticsModule,
            controllers: [StatisticsController],
            providers: [
                { provide: token.library, useValue: dependencies.library },
                { provide: token.collections, useValue: dependencies.collections },
                {
                    provide: 'STATISTICS_GET',
                    inject: [token.library, token.collections],
                    useFactory: (
                        library: LibraryStatisticsReader,
                        collections: CollectionTallies,
                    ) => new GetStatistics(library, collections),
                },
            ],
        };
    }
}
