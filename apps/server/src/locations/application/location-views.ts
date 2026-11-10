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
    bookCount: number;
    shelves: ShelfView[];
}

export interface ShelfChanges {
    name?: string;
    bookcaseId?: string;
}
