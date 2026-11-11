export interface BackgroundTasks {
    run(task: () => Promise<void>): void;
}
