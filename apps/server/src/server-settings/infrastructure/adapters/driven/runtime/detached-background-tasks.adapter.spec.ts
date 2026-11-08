import { expect, it } from 'vitest';
import { DetachedBackgroundTasks } from './detached-background-tasks.adapter.js';

it('runs the work after the caller continued', async () => {
    const tasks = new DetachedBackgroundTasks();
    const done: string[] = [];

    tasks.run(async () => {
        await Promise.resolve();
        done.push('work');
    });
    done.push('caller');
    await tasks.settled();

    expect(done).toEqual(['caller', 'work']);
});
it('keeps the server running when the work fails', async () => {
    const tasks = new DetachedBackgroundTasks();

    tasks.run(async () => {
        throw new Error('could not save');
    });

    await expect(tasks.settled()).resolves.toBeUndefined();
});
