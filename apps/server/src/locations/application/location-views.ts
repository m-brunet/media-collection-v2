export interface ShelfView {
    id: string;
    bookcaseId: string;
    name: string;
    bookCount: number;
}

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
