// The numbers of main records deleted with the library.
export type ErasedLibrary = { books: number; authors: number; collections: number; loans: number };

// Deletes every library record and the audit log, keeping the accounts, their preferences and the
// server settings, and signs every session out. Joins the transaction in progress.
export interface LibraryEraser {
    erase(): Promise<ErasedLibrary>;
}
