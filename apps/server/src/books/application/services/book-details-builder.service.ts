import type { BookInput } from '../book-input.js';
import { Book } from '../../domain/entities/book.entity.js';
import type { BookDetails } from '../../domain/entities/book.entity.js';
import { GeneratedTitle } from '../../domain/value-objects/generated-title.value-object.js';
import { Isbn } from '../../domain/value-objects/isbn.value-object.js';
import { Price } from '../../domain/value-objects/price.value-object.js';
import { PublicationDate } from '../../domain/value-objects/publication-date.value-object.js';
import { AuthorResolver } from './author-resolver.service.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

// Builds validated shared book details from what was entered in the form. A blank title asks for
// one generated from the collection, which only Manga and Comics in a collection may have; the
// title stays provisional until the membership is applied (`GeneratedTitleSync`).
export class BookDetailsBuilder {
    constructor(private readonly authors: AuthorResolver) {}

    async build(input: BookInput): Promise<BookDetails> {
        const isbn = input.noIsbn || !input.isbn?.trim() ? null : Isbn.parse(input.isbn);
        const price = input.price?.trim() ? Price.parse(input.price) : null;
        const generated = input.title.trim() === '';

        if (generated && !(Book.generatesTitle(input.category) && input.collection !== null)) {
            throw new Failure(
                'invalid_input',
                'Enter a title; only Manga and Comics in a collection get one automatically.',
                'title-required',
            );
        }

        return {
            title: generated ? BookDetailsBuilder.provisionalTitle(input) : input.title,
            titleGenerated: generated,
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

    // The collection is only known for sure once the membership is applied: an equivalent existing
    // collection keeps its own spelling, and a chosen one is known by its identity only.
    private static provisionalTitle(input: BookInput): string {
        const request = input.collection!;
        const name = 'name' in request.collection ? request.collection.name : '…';

        return GeneratedTitle.of(name, request.volumeFrom, request.volumeTo).text;
    }
}
