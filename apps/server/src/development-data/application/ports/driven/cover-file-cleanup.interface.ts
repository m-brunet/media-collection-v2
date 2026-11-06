// Removes stored cover files that no book refers to (after a reset, or a failed or successful import).
export interface CoverFileCleanup {
    // Returns the number of files removed.
    removeUnreferenced(): Promise<number>;
}
