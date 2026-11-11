import type { LendBooksUseCase } from '../ports/driving/lend-books-use-case.interface.js';
import type { LendingOutcome, LendRequest } from '../lending-input.js';
import { LoanAudit, LoanSnapshot } from '../loan-audit.js';
import type { LendableBooks } from '../ports/driven/lendable-books.interface.js';
import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import { ReceiverResolver } from '../services/receiver-resolver.service.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { Selection } from '../../domain/value-objects/selection.value-object.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class LendBooks implements LendBooksUseCase {
    constructor(
        private readonly books: LendableBooks,
        private readonly loans: LoanRepository,
        private readonly receivers: ReceiverResolver,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, request: LendRequest): Promise<LendingOutcome> {
        return this.operations.runBatch(
            {
                category: LoanAudit.lent,
                actorId: actor.id,
                subjectType: LoanAudit.book,
                subjectIds: [...new Set(request.bookIds)],
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const selection = Selection.of(request.bookIds);
                const books = await this.books.find(selection.ids);
                const found = new Set(books.map((book) => book.id));
                const missing = selection.ids.filter((id) => !found.has(id));

                if (missing.length > 0) {
                    throw new Failure(
                        'not_found',
                        'A selected book no longer exists.',
                        'book-missing',
                        {
                            bookIds: missing,
                        },
                    );
                }

                Loan.ensureLendable(books);
                const { receiver, created } = await this.receivers.resolve(request.receiver);
                const now = this.clock.now().toISOString();
                const lent: { bookId: string; loan: Loan }[] = [];

                for (const book of books) {
                    const loan = Loan.lend({
                        id: this.ids.next(),
                        book,
                        receiverId: receiver.id,
                        now,
                    });

                    await this.loans.create(loan);
                    lent.push({ bookId: book.id, loan });
                }

                return {
                    result: {
                        receiver: { id: receiver.id, name: receiver.snapshot.name },
                        loans: lent.map(({ bookId, loan }) => ({
                            loanId: loan.id,
                            bookId,
                            lentAt: loan.snapshot.lentAt,
                        })),
                    },
                    entries: lent.map(({ bookId, loan }) => ({
                        subjectId: bookId,
                        before: { loan: null },
                        after: { loan: LoanSnapshot.of(loan, receiver) },
                    })),
                    related: created ? [LoanSnapshot.receiverCreated(receiver)] : [],
                };
            },
        );
    }
}
