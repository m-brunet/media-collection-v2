import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

export class SourceBudget {
    private readonly spent: number[] = [];
    private pausedUntil = 0;

    constructor(
        private readonly limit: { requests: number; seconds: number },
        private readonly clock: Clock,
    ) {}

    take(): boolean {
        const now = this.clock.now().getTime();
        const windowStart = now - this.limit.seconds * 1000;

        while (this.spent[0] !== undefined && this.spent[0] <= windowStart) {
            this.spent.shift();
        }

        if (now < this.pausedUntil || this.spent.length >= this.limit.requests) {
            return false;
        }

        this.spent.push(now);

        return true;
    }

    pause(until: Date): void {
        this.pausedUntil = Math.max(this.pausedUntil, until.getTime());
    }
}
