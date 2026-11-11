export type ErasedLibrary = { books: number; authors: number; collections: number; loans: number };

export interface LibraryEraser {
    erase(): Promise<ErasedLibrary>;
}
