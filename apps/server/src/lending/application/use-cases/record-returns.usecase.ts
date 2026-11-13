import type { RecordReturnsUseCase } from '../ports/driving/record-returns-use-case.interface.js';
import type { ReturnOutcome } from '../lending-input.js';
import { LoanAudit, LoanSnapshot } from '../loan-audit.js';
import type { LoanRepository } from '../ports/driven/loan-repository.interface.js';
import type { ReceiverRepository } from '../ports/driven/receiver-repository.interface.js';
import { Loan } from '../../domain/entities/loan.entity.js';
import { Selection } from '../../domain/value-objects/selection.value-object.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { Required } from '../../../shared/domain/required.helper.js';

export class RecordReturns implements RecordReturnsUseCase {
    constructor(
        private readonly loans: LoanRepository,
        private readonly receivers: ReceiverRepository,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, loanIds: string[]): Promise<ReturnOutcome> {
        return this.operations.runBatch(
            {
                category: LoanAudit.returned,
                actorId: actor.id,
                subjectType: LoanAudit.loan,
                subjectIds: [...new Set(loanIds)],
            },
            async () => {
                ActorAuthorization.requireLibraryEditor(actor);
                const selection = Selection.of(loanIds);
                const loans = await this.loans.findByIds(selection.ids);
                const found = new Set(loans.map((loan) => loan.id));
                const missing = selection.ids.filter((id) => !found.has(id));

                if (missing.length > 0) {
                    throw new Failure(
                        'not_found',
                        'A selected loan no longer exists.',
                        'loan-missing',
                        {
                            loanIds: missing,
                        },
                    );
                }

                const before = new Map(loans.map((loan) => [loan.id, loan.snapshot]));
                const now = this.clock.now().toISOString();

                Loan.returnTogether(loans, now);

                for (const loan of loans) {
                    await this.loans.save(loan);
                }

                const receiver = await this.receivers.findById(
                    Required.at(loans, 0, 'at least one loan is returned').snapshot.receiverId,
                );

                if (!receiver) {
                    throw new Failure(
                        'not_found',
                        'That receiver no longer exists.',
                        'receiver-missing',
                    );
                }

                return {
                    result: {
                        receiver: { id: receiver.id, name: receiver.snapshot.name },
                        returned: loans.map((loan) => ({
                            loanId: loan.id,
                            bookId: loan.snapshot.bookId,
                            returnedAt: now,
                        })),
                    },
                    entries: loans.map((loan) => ({
                        subjectId: loan.id,
                        before: {
                            loan: LoanSnapshot.of(
                                Loan.restore(
                                    Required.value(
                                        before.get(loan.id),
                                        'every returned loan was kept as it was',
                                    ),
                                ),
                                receiver,
                            ),
                        },
                        after: { loan: LoanSnapshot.of(loan, receiver) },
                    })),
                };
            },
        );
    }
}
