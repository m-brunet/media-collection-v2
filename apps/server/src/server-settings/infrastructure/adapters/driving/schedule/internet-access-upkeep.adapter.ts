import type { MaintainInternetAccessUseCase } from '../../../../application/ports/driving/maintain-internet-access-use-case.interface.js';

// Runs the internet access upkeep once the application is up, then at a fixed interval. Nest
// calls the two lifecycle methods; a run never overlaps the previous one.
export class InternetAccessUpkeep {
    private timer: NodeJS.Timeout | undefined;
    private running: Promise<void> | undefined;

    constructor(
        private readonly maintain: MaintainInternetAccessUseCase,
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
        this.running ??= this.maintain
            .execute()
            .catch(() => undefined)
            .finally(() => {
                this.running = undefined;
            });
    }
}
