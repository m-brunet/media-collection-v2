import { Loan } from '../../../apps/server/src/lending/domain/entities/loan.entity.js';
import {
    LoanBuilder,
    type LoanBook,
} from '../../../apps/server/src/lending/application/testing/loan-builder.test-support.js';
import { ReceiverBuilder } from '../../../apps/server/src/lending/application/testing/receiver-builder.test-support.js';
import type { TestAppContext } from '../setup/test-app-context.js';

export type ArrangedLending = {
    receiver: { id: string; name: string };
    loans: { loanId: string; bookId: string; lentAt: string }[];
};

// Arranges loans in API tests through the builders, without the lending endpoints: lends books to
// a receiver (created by name, or an existing one by identity) and records returns. Books are
// given as a loan records them (identity, title, ISBN): a saved book DTO, or
// `TestLibrary.lendable(book)`. Successive lendings are a minute apart, so the newest one comes
// first in lists; all happen in December 2025, before anything the test application does at its
// own clock (from 2026-01-01).
export class LendingArrangement {
    private minutes = 0;

    constructor(private readonly context: TestAppContext) {}

    async lend(
        receiver: { name: string } | { id: string },
        ...books: LoanBook[]
    ): Promise<ArrangedLending> {
        const { builders, lending } = this.context;
        const saved =
            'id' in receiver
                ? (await lending.receivers.findById(receiver.id))!
                : await builders.receiver(new ReceiverBuilder().withName(receiver.name));
        const lentAt = new Date(Date.UTC(2025, 11, 1, 9, this.minutes++)).toISOString();
        const loans = [];

        for (const book of books) {
            loans.push(
                await builders.loan(new LoanBuilder().of(book).to(saved.id).withLentAt(lentAt)),
            );
        }

        return {
            receiver: { id: saved.id, name: saved.snapshot.name },
            loans: loans.map((loan) => ({
                loanId: loan.id,
                bookId: loan.snapshot.bookId!,
                lentAt: loan.snapshot.lentAt,
            })),
        };
    }

    async giveBack(...loanIds: string[]): Promise<void> {
        const loans = await this.context.lending.loans.findByIds(loanIds);

        Loan.returnTogether(loans, '2025-12-31T09:00:00.000Z');

        for (const loan of loans) {
            await this.context.lending.loans.save(loan);
        }
    }
}
