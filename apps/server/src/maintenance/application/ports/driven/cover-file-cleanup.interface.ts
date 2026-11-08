export interface CoverFileCleanup {
    // Removes the stored covers no book refers to and returns how many were removed.
    removeUnreferenced(): Promise<number>;
}
