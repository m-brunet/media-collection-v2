// Runs work after the request that started it has answered (the internet access setup).
export interface BackgroundTasks {
    run(task: () => Promise<void>): void;
}
