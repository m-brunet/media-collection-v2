import { afterEach, expect, it, vi } from 'vitest';
import type { RuleUpkeepOutcome } from '../../../../application/ports/driving/maintain-internet-access-use-case.interface.js';
import { InternetAccessUpkeep } from './internet-access-upkeep.adapter.js';

afterEach(() => {
    vi.useRealTimers();
});

const kept: RuleUpkeepOutcome = { rule: 'kept', address: '82.66.118.204', problem: null };
const failed: RuleUpkeepOutcome = { rule: 'failed', reason: 'no-router' };

// Each run waits for `release`, then gives the next planned outcome (the last one repeats).
class CountingMaintenance {
    runs = 0;
    release: (() => void) | null = null;

    constructor(private readonly outcomes: RuleUpkeepOutcome[] = [kept]) {}

    execute(): Promise<RuleUpkeepOutcome> {
        const outcome = this.outcomes[Math.min(this.runs, this.outcomes.length - 1)] ?? kept;

        this.runs++;

        return new Promise((resolve) => {
            this.release = () => resolve(outcome);
        });
    }
}

// 1 second after a run that kept the rules, 100 ms after each failed one.
function delayAfter(failedRuns: number): number {
    return failedRuns === 0 ? 1000 : 100;
}

function upkeepOf(maintenance: CountingMaintenance, log: (line: string) => void = () => {}) {
    return new InternetAccessUpkeep([{ name: 'HTTP', maintenance }], delayAfter, log);
}

it('runs the upkeep once the application is up', () => {
    const maintenance = new CountingMaintenance();
    const upkeep = upkeepOf(maintenance);

    upkeep.onApplicationBootstrap();

    expect(maintenance.runs).toBe(1);
    maintenance.release?.();
    void upkeep.onModuleDestroy();
});
it('runs again after the delay of a run that kept the rules', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance();
    const upkeep = upkeepOf(maintenance);

    upkeep.onApplicationBootstrap();
    maintenance.release?.();
    await vi.advanceTimersByTimeAsync(1000);

    expect(maintenance.runs).toBe(2);
    maintenance.release?.();
    await upkeep.onModuleDestroy();
});
it('tries again sooner after a run that could not keep a rule', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance([failed]);
    const upkeep = upkeepOf(maintenance);

    upkeep.onApplicationBootstrap();
    maintenance.release?.();
    await vi.advanceTimersByTimeAsync(100);

    expect(maintenance.runs).toBe(2);
    maintenance.release?.();
    await upkeep.onModuleDestroy();
});
it('counts consecutive failed runs for the delay', async () => {
    vi.useFakeTimers();
    const outcomes = [failed, failed, kept];
    const delays: number[] = [];
    const upkeep = new InternetAccessUpkeep(
        [{ name: 'HTTP', maintenance: { execute: async () => outcomes.shift() ?? kept } }],
        (failedRuns) => {
            delays.push(failedRuns);

            return 10;
        },
        () => {},
    );

    upkeep.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(25);

    expect(delays).toEqual([1, 2, 0]);
    await upkeep.onModuleDestroy();
});
it('never overlaps a run that is still going', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance();
    const upkeep = upkeepOf(maintenance);

    upkeep.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(3000);

    expect(maintenance.runs).toBe(1);
    maintenance.release?.();
    await upkeep.onModuleDestroy();
});
it('stops at shutdown after the current run', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance();
    const upkeep = upkeepOf(maintenance);

    upkeep.onApplicationBootstrap();
    maintenance.release?.();
    await upkeep.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5000);

    expect(maintenance.runs).toBe(1);
});
it('runs each upkeep in turn', async () => {
    const order: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [
            {
                name: 'HTTPS',
                maintenance: { execute: async () => (order.push('https'), kept) },
            },
            { name: 'HTTP', maintenance: { execute: async () => (order.push('http'), kept) } },
        ],
        delayAfter,
        () => {},
    );

    upkeep.onApplicationBootstrap();
    await upkeep.onModuleDestroy();

    expect(order).toEqual(['https', 'http']);
});
it('runs the next upkeep after one fails', async () => {
    const order: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [
            {
                name: 'HTTPS',
                maintenance: {
                    execute: async () => {
                        throw new Error('router gone');
                    },
                },
            },
            { name: 'HTTP', maintenance: { execute: async () => (order.push('http'), kept) } },
        ],
        delayAfter,
        () => {},
    );

    upkeep.onApplicationBootstrap();
    await upkeep.onModuleDestroy();

    expect(order).toEqual(['http']);
});
it('logs a kept rule with its public address', async () => {
    const lines: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [{ name: 'HTTP', maintenance: { execute: async () => kept } }],
        delayAfter,
        (line) => lines.push(line),
    );

    upkeep.onApplicationBootstrap();
    await upkeep.onModuleDestroy();

    expect(lines).toEqual([
        'Internet access upkeep, HTTP: router rule kept, public address 82.66.118.204',
    ]);
});
it('logs a kept rule with the failure still shown', async () => {
    const lines: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [
            {
                name: 'HTTPS',
                maintenance: {
                    execute: async () => ({ ...kept, problem: 'domain-mismatch' as const }),
                },
            },
        ],
        delayAfter,
        (line) => lines.push(line),
    );

    upkeep.onApplicationBootstrap();
    await upkeep.onModuleDestroy();

    expect(lines).toEqual([
        'Internet access upkeep, HTTPS: router rule kept, public address 82.66.118.204, still failing: domain-mismatch',
    ]);
});
it('logs a rule that could not be kept and when it is tried again', async () => {
    vi.useFakeTimers();
    const lines: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [{ name: 'HTTP', maintenance: { execute: async () => failed } }],
        () => 5 * 60 * 1000,
        (line) => lines.push(line),
    );

    upkeep.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);

    expect(lines).toEqual([
        'Internet access upkeep, HTTP: router rule not kept (no-router)',
        'Internet access upkeep: next try in 5 min',
    ]);
    await upkeep.onModuleDestroy();
});
it('logs an unexpected upkeep error', async () => {
    const lines: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [
            {
                name: 'HTTPS',
                maintenance: {
                    execute: async () => {
                        throw new Error('router gone');
                    },
                },
            },
        ],
        delayAfter,
        (line) => lines.push(line),
    );

    upkeep.onApplicationBootstrap();
    await upkeep.onModuleDestroy();

    expect(lines).toEqual([
        'Internet access upkeep, HTTPS: error, router gone',
        'Internet access upkeep, HTTPS: router rule not kept (setup-failed)',
    ]);
});
it('logs nothing when internet access is off', async () => {
    const lines: string[] = [];
    const upkeep = new InternetAccessUpkeep(
        [{ name: 'HTTP', maintenance: { execute: async () => ({ rule: 'none' as const }) } }],
        delayAfter,
        (line) => lines.push(line),
    );

    upkeep.onApplicationBootstrap();
    await upkeep.onModuleDestroy();

    expect(lines).toEqual([]);
});
