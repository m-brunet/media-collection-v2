import { afterEach, expect, it, vi } from 'vitest';
import { InternetAccessUpkeep } from './internet-access-upkeep.adapter.js';

afterEach(() => {
    vi.useRealTimers();
});

class CountingMaintenance {
    runs = 0;
    release: (() => void) | null = null;

    execute(): Promise<void> {
        this.runs++;

        return new Promise((resolve) => {
            this.release = resolve;
        });
    }
}

it('runs the upkeep once the application is up', () => {
    const maintenance = new CountingMaintenance();
    const upkeep = new InternetAccessUpkeep(maintenance, 1000);

    upkeep.onApplicationBootstrap();

    expect(maintenance.runs).toBe(1);
    maintenance.release?.();
    void upkeep.onModuleDestroy();
});
it('runs again at each interval once the previous run ended', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance();
    const upkeep = new InternetAccessUpkeep(maintenance, 1000);

    upkeep.onApplicationBootstrap();
    maintenance.release?.();
    await vi.advanceTimersByTimeAsync(1000);

    expect(maintenance.runs).toBe(2);
    maintenance.release?.();
    await upkeep.onModuleDestroy();
});
it('never overlaps a run that is still going', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance();
    const upkeep = new InternetAccessUpkeep(maintenance, 1000);

    upkeep.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(3000);

    expect(maintenance.runs).toBe(1);
    maintenance.release?.();
    await upkeep.onModuleDestroy();
});
it('stops at shutdown after the current run', async () => {
    vi.useFakeTimers();
    const maintenance = new CountingMaintenance();
    const upkeep = new InternetAccessUpkeep(maintenance, 1000);

    upkeep.onApplicationBootstrap();
    maintenance.release?.();
    await upkeep.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(5000);

    expect(maintenance.runs).toBe(1);
});
