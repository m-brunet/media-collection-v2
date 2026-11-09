// When the internet access upkeep runs again. Hourly keeps a router rule well inside its 2-hour
// lease; after a run that could not keep the rule, it tries again soon (1, 5, then 15 minutes)
// before going back to hourly.
export class UpkeepSchedule {
    static readonly interval = 60 * 60 * 1000;
    private static readonly retries = [1, 5, 15].map((minutes) => minutes * 60 * 1000);

    // `failedRuns`: consecutive runs that could not keep a router rule.
    static delayAfter(failedRuns: number): number {
        if (failedRuns === 0) {
            return UpkeepSchedule.interval;
        }

        return UpkeepSchedule.retries[failedRuns - 1] ?? UpkeepSchedule.interval;
    }
}
