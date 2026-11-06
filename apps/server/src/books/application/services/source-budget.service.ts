import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';

// Keeps the requests to one source within its rate limit (book entry rules, "Lookup sources"):
// at most `requests` in any `seconds`, and none at all while the source asked to wait.
export class SourceBudget {
    private readonly spent: number[] = [];
    private pausedUntil = 0;

    constructor(
        private readonly limit: { requests: number; seconds: number },
        private readonly clock: Clock,
    ) {}

    // Takes one request from the budget, or answers false when the source must not be asked now.
    take(): boolean {
        const now = this.clock.now().getTime();
        const windowStart = now - this.limit.seconds * 1000;

        while (this.spent.length > 0 && this.spent[0]! <= windowStart) {
            this.spent.shift();
        }

        if (now < this.pausedUntil || this.spent.length >= this.limit.requests) {
            return false;
        }

        this.spent.push(now);

        return true;
    }

    // The source said "too many requests": ask nothing before `until`.
    pause(until: Date): void {
        this.pausedUntil = Math.max(this.pausedUntil, until.getTime());
    }
}
