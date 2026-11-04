// Runs work atomically: every change inside commits together or none does.
export interface TransactionRunner {
    run<T>(work: () => Promise<T>): Promise<T>;
}
