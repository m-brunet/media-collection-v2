import type { ActiveLoansQuery, ReceiverLoansView } from '../loan-views.js';
import type { ActiveLoans } from '../ports/driven/active-loans.interface.js';
import type { LendableBooks } from '../ports/driven/lendable-books.interface.js';
import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import { ReceiverResolver } from '../services/receiver-resolver.service.js';
import type { LoanBook } from './loan-builder.test-support.js';
import { Loan, type LendableBook } from '../../domain/entities/loan.entity.js';
import { Receiver } from '../../domain/entities/receiver.entity.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { Required } from '../../../shared/domain/required.helper.js';

export class MemoryReceivers implements ReceiverRepository {
    readonly receivers = new Map<string, Receiver>();

    async findById(id: string): Promise<Receiver | null> {
        const receiver = this.receivers.get(id);

        return receiver ? new Receiver(receiver.snapshot) : null;
    }

    async findByIds(ids: readonly string[]): Promise<Receiver[]> {
        return ids.flatMap((id) => {
            const receiver = this.receivers.get(id);

            return receiver ? [new Receiver(receiver.snapshot)] : [];
        });
    }

    async findByKey(key: string): Promise<Receiver | null> {
        const receiver = [...this.receivers.values()].find((value) => value.key === key);

        return receiver ? new Receiver(receiver.snapshot) : null;
    }

    async list(): Promise<Receiver[]> {
        return [...this.receivers.values()]
            .sort((first, second) => first.key.localeCompare(second.key))
            .map((receiver) => new Receiver(receiver.snapshot));
    }

    async create(receiver: Receiver): Promise<void> {
        this.receivers.set(receiver.id, new Receiver(receiver.snapshot));
    }
}

export class MemoryLoanStore implements LoanRepository {
    readonly loans = new Map<string, Loan>();

    async findByIds(ids: readonly string[]): Promise<Loan[]> {
        return ids.flatMap((id) => {
            const loan = this.loans.get(id);

            return loan ? [Loan.restore(loan.snapshot)] : [];
        });
    }

    async findActiveByBooks(bookIds: readonly string[]): Promise<Loan[]> {
        return [...this.loans.values()]
            .filter((loan) => loan.active && bookIds.includes(loan.snapshot.bookId ?? ''))
            .map((loan) => Loan.restore(loan.snapshot));
    }

    async create(loan: Loan): Promise<void> {
        const bookId = loan.snapshot.bookId;

        if ((await this.findActiveByBooks([bookId ?? ''])).length > 0) {
            throw new Failure('conflict', 'Already lent', 'book-already-lent', {
                bookIds: [bookId],
            });
        }

        this.loans.set(loan.id, Loan.restore(loan.snapshot));
    }

    async save(loan: Loan): Promise<void> {
        this.loans.set(loan.id, Loan.restore(loan.snapshot));
    }

    async keepIdentification(book: {
        id: string;
        title: string;
        isbn: string | null;
    }): Promise<void> {
        for (const [id, loan] of this.loans) {
            if (loan.snapshot.bookId === book.id) {
                this.loans.set(
                    id,
                    Loan.restore({ ...loan.snapshot, bookTitle: book.title, bookIsbn: book.isbn }),
                );
            }
        }
    }

    of(bookId: string): Loan[] {
        return [...this.loans.values()].filter((loan) => loan.snapshot.bookId === bookId);
    }
}

export class MemoryLendableBooks implements LendableBooks {
    readonly books = new Map<string, Omit<LendableBook, 'lentTo'>>();

    constructor(
        private readonly loans: MemoryLoanStore,
        private readonly receivers: MemoryReceivers,
    ) {}

    lendable(id: string): LoanBook {
        const book = Required.value(this.books.get(id), 'book ' + id + ' is known to the double');

        return { id: book.id, title: book.title, isbn: book.isbn };
    }

    add(id: string, title: string, ownership: LendableBook['ownership'] = 'owned'): string {
        this.books.set(id, { id, title, isbn: null, ownership });

        return id;
    }

    async find(ids: readonly string[]): Promise<LendableBook[]> {
        const lentTo = new Map<string | null, string>();

        for (const loan of await this.loans.findActiveByBooks(ids)) {
            const receiver = this.receivers.receivers.get(loan.snapshot.receiverId);

            lentTo.set(loan.snapshot.bookId, receiver?.snapshot.name ?? '');
        }

        return ids.flatMap((id) => {
            const book = this.books.get(id);

            return book ? [{ ...book, lentTo: lentTo.get(id) ?? null }] : [];
        });
    }
}

export class ActiveLoansStub implements ActiveLoans {
    readonly queries: ActiveLoansQuery[] = [];
    groups: ReceiverLoansView[] = [];

    async list(query: ActiveLoansQuery): Promise<ReceiverLoansView[]> {
        this.queries.push(query);

        return this.groups;
    }
}

export class LendingDoubles {
    static lending() {
        const receivers = new MemoryReceivers();
        const loans = new MemoryLoanStore();
        const books = new MemoryLendableBooks(loans, receivers);
        const trail = new MemoryAuditTrail();
        let counter = 0;
        const ids = { next: () => 'id-' + ++counter };
        const clock = { now: () => new Date('2026-10-30T09:00:00Z') };

        return {
            receivers,
            loans,
            books,
            trail,
            ids,
            clock,
            operations: AuditDoubles.auditedOperation(trail),
            resolver: new ReceiverResolver(receivers, ids, clock),
            active: new ActiveLoansStub(),
        };
    }
}

export const owner = TestActors.of('owner', 'camille');
export const administrator = TestActors.of('admin', 'alex');
export const guest = TestActors.of('guest', 'morgan');
