export interface CoverFileCleanup {
    removeUnreferenced(): Promise<number>;
}
