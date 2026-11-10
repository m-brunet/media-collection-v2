import type { Book } from '../../../apps/server/src/books/domain/entities/book.entity.js';
import {
    BookBuilder,
    type BookPorts,
} from '../../../apps/server/src/books/application/testing/book-builder.test-support.js';
import type { Loan } from '../../../apps/server/src/lending/domain/entities/loan.entity.js';
import type { Receiver } from '../../../apps/server/src/lending/domain/entities/receiver.entity.js';
import {
    LoanBuilder,
    type LoanBook,
    type LoanPorts,
} from '../../../apps/server/src/lending/application/testing/loan-builder.test-support.js';
import { ReceiverBuilder } from '../../../apps/server/src/lending/application/testing/receiver-builder.test-support.js';

export type LibraryPorts = BookPorts & LoanPorts;

// A book described as plain facts, for tests outside the books feature, which may not use its
// builder directly (feature boundaries apply to tests too).
export type BookFacts = {
    title?: string;
    authors?: string[];
    isbn?: string;
    publisher?: string;
    publicationYear?: number;
    planned?: boolean;
};

export class TestLibrary {
    constructor(private readonly ports: LibraryPorts) {}

    book(book: BookBuilder | BookFacts = new BookBuilder()): Promise<Book> {
        const builder = book instanceof BookBuilder ? book : TestLibrary.described(book);

        return builder.buildAndSave(this.ports);
    }

    receiver(builder = new ReceiverBuilder()): Promise<Receiver> {
        return builder.buildAndSave(this.ports);
    }

    async loan(builder = new LoanBuilder(), book?: Book): Promise<Loan> {
        const lent = book ?? (builder.hasBook() ? null : await this.book());

        if (lent) {
            builder.of(TestLibrary.lendable(lent));
        }

        return builder.buildAndSave(this.ports);
    }

    private static described(facts: BookFacts): BookBuilder {
        const builder = new BookBuilder();

        if (facts.title !== undefined) {
            builder.withTitle(facts.title);
        }

        if (facts.authors !== undefined) {
            builder.withAuthors(...facts.authors);
        }

        if (facts.isbn !== undefined) {
            builder.withIsbn(facts.isbn);
        }

        if (facts.publisher !== undefined) {
            builder.withPublisher(facts.publisher);
        }

        if (facts.publicationYear !== undefined) {
            builder.withPublicationYear(facts.publicationYear);
        }

        if (facts.planned) {
            builder.asPlanned();
        }

        return builder;
    }

    static lendable(book: Book): LoanBook {
        const { title, isbn } = book.details;

        return { id: book.id, title, isbn: isbn?.isbn13 ?? null };
    }
}
