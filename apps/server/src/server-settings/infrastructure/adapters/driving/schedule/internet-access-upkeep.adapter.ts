import type {
    MaintainInternetAccessUseCase,
    RuleUpkeepOutcome,
} from '../../../../application/ports/driving/maintain-internet-access-use-case.interface.js';
import type { MaintainHttpInternetAccessUseCase } from '../../../../application/ports/driving/maintain-http-internet-access-use-case.interface.js';

export interface NamedMaintenance {
    name: string;
    maintenance: MaintainInternetAccessUseCase | MaintainHttpInternetAccessUseCase;
}

export class InternetAccessUpkeep {
    private timer: NodeJS.Timeout | undefined;
    private running: Promise<void> | undefined;
    private failedRuns = 0;
    private stopped = false;

    constructor(
        private readonly maintenances: readonly NamedMaintenance[],
        private readonly delayAfter: (failedRuns: number) => number,
        private readonly log: (line: string) => void = console.log,
    ) {}

    onApplicationBootstrap(): void {
        this.run();
    }

    async onModuleDestroy(): Promise<void> {
        this.stopped = true;
        clearTimeout(this.timer);
        await this.running;
    }

    private run(): void {
        this.running = this.runAll().then((failed) => {
            this.running = undefined;
            this.failedRuns = failed ? this.failedRuns + 1 : 0;

            if (this.stopped) {
                return;
            }

            const delay = this.delayAfter(this.failedRuns);

            if (failed) {
                this.log(
                    'Internet access upkeep: next try in ' + Math.round(delay / 60000) + ' min',
                );
            }

            this.timer = setTimeout(() => this.run(), delay);
            this.timer.unref();
        });
    }

    private async runAll(): Promise<boolean> {
        let failed = false;

        for (const { name, maintenance } of this.maintenances) {
            const outcome = await maintenance
                .execute()
                .catch((error: unknown): RuleUpkeepOutcome => {
                    this.log(
                        'Internet access upkeep, ' + name + ': error, ' + this.describe(error),
                    );

                    return { rule: 'failed', reason: 'setup-failed' };
                });

            failed ||= outcome.rule === 'failed';
            this.report(name, outcome);
        }

        return failed;
    }

    private report(name: string, outcome: RuleUpkeepOutcome): void {
        const prefix = 'Internet access upkeep, ' + name + ': ';

        if (outcome.rule === 'failed') {
            this.log(prefix + 'router rule not kept (' + outcome.reason + ')');
        } else if (outcome.rule === 'kept') {
            this.log(
                prefix +
                    'router rule kept, public address ' +
                    outcome.address +
                    (outcome.problem ? ', still failing: ' + outcome.problem : ''),
            );
        }
    }

    private describe(error: unknown): string {
        return error instanceof Error ? error.message : String(error);
    }
}
