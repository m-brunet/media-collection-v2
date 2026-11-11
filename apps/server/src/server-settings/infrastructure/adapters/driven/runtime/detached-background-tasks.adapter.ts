import type { BackgroundTasks } from '../../../../application/ports/driven/background-tasks.interface.js';

export class DetachedBackgroundTasks implements BackgroundTasks {
    private readonly running = new Set<Promise<void>>();

    run(task: () => Promise<void>): void {
        const work = task()
            .catch(() => undefined)
            .finally(() => this.running.delete(work));

        this.running.add(work);
    }

    async settled(): Promise<void> {
        await Promise.all([...this.running]);
    }
}
