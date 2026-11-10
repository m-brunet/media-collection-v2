export interface CoverFileCleanup {
    // Returns the number of files removed.
    removeUnreferenced(): Promise<number>;
}
