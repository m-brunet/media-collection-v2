import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import { ReceiverBuilder } from './receiver-builder.test-support.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import {
    BuilderError,
    EntityBuilder,
} from '../../../shared/application/testing/entity-builder.test-support.js';
import { TestIds } from '../../../shared/application/testing/test-ids.test-support.js';

export type LoanPorts = { loans: LoanRepository; receivers: ReceiverRepository };

export type LoanBook = { id: string; title?: string; isbn?: string | null };

// Saving creates a receiver when none was given; the book must exist already (lending never
// creates books), so give it with `of(…)`, or let `TestLibrary` create it.
export class LoanBuilder extends EntityBuilder<Loan, LoanPorts> {
    private id: string | null = null;
    private book: LoanBook | null = null;
    private receiverId: string | null = null;
    private lentAt = '2026-10-01T09:00:00.000Z';
    private returnedAt: string | null = null;

    withId(id: string): this {
        this.id = id;

        return this;
    }

    of(book: LoanBook): this {
        this.book = book;

        return this;
    }

    to(receiverId: string): this {
        this.receiverId = receiverId;

        return this;
    }

    withLentAt(lentAt: string): this {
        this.lentAt = lentAt;

        return this;
    }

    hasBook(): boolean {
        return this.book !== null;
    }

    asReturned(returnedAt = '2026-10-15T09:00:00.000Z'): this {
        this.returnedAt = returnedAt;

        return this;
    }

    build(): Loan {
        const book = this.book ?? { id: TestIds.next() };

        return Loan.restore({
            id: this.id ?? TestIds.next(),
            bookId: book.id,
            receiverId: this.receiverId ?? TestIds.next(),
            status: this.returnedAt ? 'returned' : 'lent',
            lentAt: this.lentAt,
            returnedAt: this.returnedAt,
            bookTitle: book.title ?? 'Lent book',
            bookIsbn: book.isbn ?? null,
        });
    }

    async buildAndSave(ports: LoanPorts): Promise<Loan> {
        if (!this.book) {
            throw new BuilderError('LoanBuilder', 'a book', 'give a saved book with of(…).');
        }

        this.receiverId ??= (await new ReceiverBuilder().buildAndSave(ports)).id;
        const loan = this.build();

        await ports.loans.create(loan);

        return loan;
    }
}
