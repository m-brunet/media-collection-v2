import { describe, expect, it } from 'vitest';
import { ManualClock } from '../testing/book-doubles.test-support.js';
import { SourceBudget } from './source-budget.service.js';

describe('SourceBudget', () => {
    it('allows requests up to the limit', () => {
        const budget = new SourceBudget({ requests: 2, seconds: 60 }, new ManualClock());

        const taken = [budget.take(), budget.take(), budget.take()];

        expect(taken).toEqual([true, true, false]);
    });

    it('allows requests again once the window has passed', () => {
        const clock = new ManualClock();
        const budget = new SourceBudget({ requests: 1, seconds: 60 }, clock);

        budget.take();
        clock.advance(60);

        expect(budget.take()).toBe(true);
    });

    it('asks nothing while the source asked to wait (example 20)', () => {
        const clock = new ManualClock();
        const budget = new SourceBudget({ requests: 100, seconds: 60 }, clock);

        budget.pause(new Date(clock.now().getTime() + 30_000));

        expect(budget.take()).toBe(false);
    });

    it('asks again once the wait is over', () => {
        const clock = new ManualClock();
        const budget = new SourceBudget({ requests: 100, seconds: 60 }, clock);

        budget.pause(new Date(clock.now().getTime() + 30_000));
        clock.advance(30);

        expect(budget.take()).toBe(true);
    });
});
