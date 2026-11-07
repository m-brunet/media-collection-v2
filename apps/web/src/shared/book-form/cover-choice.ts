// The cover chosen in a book form: kept locally and uploaded only when the book is saved.
export interface CoverChoice {
    file: File | null;
    removed: boolean;
}
