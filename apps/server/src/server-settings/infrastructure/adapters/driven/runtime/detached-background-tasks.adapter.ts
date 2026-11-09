import type { BackgroundTasks } from '../../../../application/ports/driven/background-tasks.interface.js';

// Runs work after the request answered. The work records its own outcome; an error here only
// means the outcome could not be saved, and must not stop the server.
export class DetachedBackgroundTasks implements BackgroundTasks {
    private readonly running = new Set<Promise<void>>();

    run(task: () => Promise<void>): void {
        const work = task()
            .catch(() => undefined)
            .finally(() => this.running.delete(work));

        this.running.add(work);
    }

    // Shutdown waits for the setup to save where it stopped.
    async settled(): Promise<void> {
        await Promise.all([...this.running]);
    }
}
