import type { ActiveLoansQuery, ReceiverLoansView } from '../loan-views.js';
import type { ActiveLoans } from '../ports/driven/active-loans.interface.js';
import type { LendableBooks } from '../ports/driven/lendable-books.interface.js';
import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import { ReceiverResolver } from '../services/receiver-resolver.service.js';
import { Loan, type LendableBook } from '../../domain/entities/loan.entity.js';
import { Receiver } from '../../domain/entities/receiver.entity.js';
import {
    auditedOperation,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

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

// Loans with the production contract: one active loan per book.
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

// The books lending reads; whether each is lent comes from the loan store.
export class MemoryLendableBooks implements LendableBooks {
    readonly books = new Map<string, Omit<LendableBook, 'lent'>>();

    constructor(private readonly loans: MemoryLoanStore) {}

    add(id: string, title: string, ownership: LendableBook['ownership'] = 'owned'): string {
        this.books.set(id, { id, title, isbn: null, ownership });

        return id;
    }

    async find(ids: readonly string[]): Promise<LendableBook[]> {
        const lent = new Set(
            (await this.loans.findActiveByBooks(ids)).map((loan) => loan.snapshot.bookId),
        );

        return ids.flatMap((id) => {
            const book = this.books.get(id);

            return book ? [{ ...book, lent: lent.has(id) }] : [];
        });
    }
}

// Records the queries it is asked and answers with prepared groups.
export class ActiveLoansStub implements ActiveLoans {
    readonly queries: ActiveLoansQuery[] = [];
    groups: ReceiverLoansView[] = [];

    async list(query: ActiveLoansQuery): Promise<ReceiverLoansView[]> {
        this.queries.push(query);

        return this.groups;
    }
}

// Lending with all doubles and services wired as in production.
export function lending() {
    const receivers = new MemoryReceivers();
    const loans = new MemoryLoanStore();
    const books = new MemoryLendableBooks(loans);
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
        operations: auditedOperation(trail),
        resolver: new ReceiverResolver(receivers, ids, clock),
        active: new ActiveLoansStub(),
    };
}

// Saves a receiver, for arranging scenarios.
export async function receiver(
    current: ReturnType<typeof lending>,
    name: string,
): Promise<Receiver> {
    const created = new Receiver({
        id: 'receiver-' + name.toLowerCase().replace(/\s+/g, '-'),
        name,
        createdAt: '2026-01-01T00:00:00.000Z',
    });

    await current.receivers.create(created);

    return created;
}

// Saves an active loan, for arranging scenarios.
export async function lent(
    current: ReturnType<typeof lending>,
    bookId: string,
    receiverId: string,
    lentAt = '2026-10-01T09:00:00.000Z',
): Promise<Loan> {
    const book = current.books.books.get(bookId)!;
    const loan = Loan.lend({
        id: 'loan-' + bookId + '-' + lentAt,
        book: { ...book, lent: false },
        receiverId,
        now: lentAt,
    });

    await current.loans.create(loan);

    return loan;
}

function actor(role: Actor['role'], id: string): Actor {
    return { id, username: id, role, mustChangePassword: false, language: null };
}

export const owner = actor('owner', 'camille');
export const administrator = actor('admin', 'alex');
export const guest = actor('guest', 'morgan');
