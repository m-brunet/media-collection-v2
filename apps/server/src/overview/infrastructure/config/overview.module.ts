import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import type { LibrarySummaryReader } from '../../application/ports/driven/library-summary-reader.interface.js';
import { GetOverview } from '../../application/use-cases/get-overview.usecase.js';
import { OverviewController } from '../adapters/driving/web/overview.controller.js';

// Driven adapters the overview feature reads from.
export interface OverviewDependencies {
    summary: LibrarySummaryReader;
}

const token = { summary: 'OVERVIEW_SUMMARY' } as const;

@Module({})
export class OverviewModule {
    static register(dependencies: OverviewDependencies): DynamicModule {
        return {
            module: OverviewModule,
            controllers: [OverviewController],
            providers: [
                { provide: token.summary, useValue: dependencies.summary },
                {
                    provide: 'OVERVIEW_GET',
                    inject: [token.summary],
                    useFactory: (summary: LibrarySummaryReader) => new GetOverview(summary),
                },
            ],
        };
    }
}
