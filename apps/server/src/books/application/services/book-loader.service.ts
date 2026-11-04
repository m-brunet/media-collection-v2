import type { BookRepository } from '../ports/driven/book-repository.interface.js';
import type { Book } from '../../domain/entities/book.entity.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class BookLoader {
    constructor(private readonly books: BookRepository) {}

    async load(id: string): Promise<Book> {
        const book = await this.books.findById(id);

        if (!book) {
            throw new Failure('not_found', 'That book does not exist.', 'book-missing');
        }

        return book;
    }
}
