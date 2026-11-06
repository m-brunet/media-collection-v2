import type { BookInput } from '../book-input.js';
import type { BookDetails } from '../../domain/entities/book.entity.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import { Price } from '../../domain/value-objects/price.value-object.js';
import { PublicationDate } from '../../domain/value-objects/publication-date.value-object.js';
import { AuthorResolver } from './author-resolver.service.js';

// Builds validated shared book details from what was entered in the form.
export class BookDetailsBuilder {
    constructor(private readonly authors: AuthorResolver) {}

    async build(input: BookInput): Promise<BookDetails> {
        const isbn = input.noIsbn || !input.isbn?.trim() ? null : Isbn.parse(input.isbn);
        const price = input.price?.trim() ? Price.parse(input.price) : null;

        return {
            title: input.title,
            titleGenerated: false,
            isbn,
            noIsbn: input.noIsbn,
            authorIds: await this.authors.resolve(input.authors),
            category: input.category,
            ownership: input.ownership,
            publisher: input.publisher,
            publicationDate: PublicationDate.from(input.publicationYear, input.publicationMonth),
            summary: input.summary,
            pageCount: input.pageCount,
            price,
        };
    }
}
