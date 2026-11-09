import { expect, it } from 'vitest';
import { UpkeepSchedule } from './upkeep-schedule.service.js';

const minute = 60 * 1000;

it('runs again in an hour after a run that kept the rules', () => {
    const delay = UpkeepSchedule.delayAfter(0);

    expect(delay).toBe(60 * minute);
});
it('tries again after a minute when a rule could not be kept', () => {
    const delay = UpkeepSchedule.delayAfter(1);

    expect(delay).toBe(minute);
});
it('tries again after five minutes on the second failed run', () => {
    const delay = UpkeepSchedule.delayAfter(2);

    expect(delay).toBe(5 * minute);
});
it('tries again after fifteen minutes on the third failed run', () => {
    const delay = UpkeepSchedule.delayAfter(3);

    expect(delay).toBe(15 * minute);
});
it('goes back to hourly after three quick retries', () => {
    const delay = UpkeepSchedule.delayAfter(4);

    expect(delay).toBe(60 * minute);
});
