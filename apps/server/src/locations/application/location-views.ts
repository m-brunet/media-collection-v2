// Read models returned by the locations use cases.

export interface ShelfView {
    id: string;
    bookcaseId: string;
    name: string;
    bookCount: number;
}

// Shelves in name order, numbers compared by value ("Shelf 2" before "Shelf 10").
export interface BookcaseView {
    id: string;
    name: string;
    // Books on all its shelves.
    bookCount: number;
    shelves: ShelfView[];
}

// A rename, a move to another bookcase, or both.
export interface ShelfChanges {
    name?: string;
    bookcaseId?: string;
}
