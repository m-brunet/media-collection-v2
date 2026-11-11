import type { Book } from '../../../domain/entities/book.entity.js';

export interface BookRepository {
    findById(id: string): Promise<Book | null>;
    findByIsbn(isbn13: string): Promise<Book | null>;
    listWithoutIsbn(): Promise<Book[]>;
    create(book: Book): Promise<void>;
    save(book: Book): Promise<void>;
    delete(id: string): Promise<void>;
}
