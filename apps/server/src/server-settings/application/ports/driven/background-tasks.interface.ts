// Runs work after the request that started it has answered.
export interface BackgroundTasks {
    run(task: () => Promise<void>): void;
}
