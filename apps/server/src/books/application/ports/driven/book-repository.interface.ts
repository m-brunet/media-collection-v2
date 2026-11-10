import type { Book } from '../../../domain/entities/book.entity.js';

export interface BookRepository {
    findById(id: string): Promise<Book | null>;
    findByIsbn(isbn13: string): Promise<Book | null>;
    listWithoutIsbn(): Promise<Book[]>;
    // An equal ISBN-13 already saved is a conflict (`isbn-taken`).
    create(book: Book): Promise<void>;
    save(book: Book): Promise<void>;
    delete(id: string): Promise<void>;
}
