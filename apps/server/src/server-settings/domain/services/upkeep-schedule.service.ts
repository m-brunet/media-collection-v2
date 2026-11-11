// Hourly keeps a router rule well inside its 2-hour lease.
export class UpkeepSchedule {
    static readonly interval = 60 * 60 * 1000;
    private static readonly retries = [1, 5, 15].map((minutes) => minutes * 60 * 1000);

    static delayAfter(failedRuns: number): number {
        if (failedRuns === 0) {
            return UpkeepSchedule.interval;
        }

        return UpkeepSchedule.retries[failedRuns - 1] ?? UpkeepSchedule.interval;
    }
}
