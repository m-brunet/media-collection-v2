import type { MaintainHttpInternetAccessUseCase } from '../../../../application/ports/driving/maintain-http-internet-access-use-case.interface.js';
import type { MaintainInternetAccessUseCase } from '../../../../application/ports/driving/maintain-internet-access-use-case.interface.js';

type Maintenance = MaintainInternetAccessUseCase | MaintainHttpInternetAccessUseCase;

// Runs the internet access upkeeps (HTTPS, then HTTP) once the application is up, then at a fixed
// interval. Nest calls the two lifecycle methods; a run never overlaps the previous one, and one
// failing upkeep does not stop the next.
export class InternetAccessUpkeep {
    private timer: NodeJS.Timeout | undefined;
    private running: Promise<void> | undefined;

    constructor(
        private readonly maintenances: readonly Maintenance[],
        private readonly interval: number,
    ) {}

    onApplicationBootstrap(): void {
        this.tick();
        this.timer = setInterval(() => this.tick(), this.interval);
        this.timer.unref();
    }

    async onModuleDestroy(): Promise<void> {
        clearInterval(this.timer);
        await this.running;
    }

    private tick(): void {
        this.running ??= this.runAll().finally(() => {
            this.running = undefined;
        });
    }

    private async runAll(): Promise<void> {
        for (const maintenance of this.maintenances) {
            await maintenance.execute().catch(() => undefined);
        }
    }
}
