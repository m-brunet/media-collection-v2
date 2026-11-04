import type { AuditTrail } from '../ports/driven/audit-trail.interface.js';
import type { Clock } from '../ports/driven/clock.interface.js';
import type { IdGenerator } from '../ports/driven/id-generator.interface.js';
import type { TransactionRunner } from '../ports/driven/transaction-runner.interface.js';
import { Failure } from '../../domain/exceptions/failure.js';

// What an audited operation is about. The change may fill in the actor or subject once known
// (for example after finding the account of a sign-in attempt).
export interface AuditContext {
    category: string;
    actorId: string | null;
    subjectType: string;
    subjectId: string | null;
}

// The outcome of a successful change, with credential-free before/after snapshots.
export interface AuditedChange<T> {
    result: T;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
}

// Runs a user-initiated state change atomically with its Successful audit record. If the change
// fails, nothing of it persists and a Failed record is written after the rollback.
export class AuditedOperation {
    constructor(
        private readonly transactions: TransactionRunner,
        private readonly audit: AuditTrail,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async run<T>(
        context: AuditContext,
        change: (context: AuditContext) => Promise<AuditedChange<T>>,
    ): Promise<T> {
        const operationId = this.ids.next();

        try {
            return await this.transactions.run(async () => {
                const outcome = await change(context);

                await this.audit.record({
                    ...this.base(operationId, context),
                    outcome: 'successful',
                    before: outcome.before,
                    after: outcome.after,
                    failure: null,
                });

                return outcome.result;
            });
        } catch (error) {
            await this.recordFailure(operationId, context, error);

            throw error;
        }
    }

    private async recordFailure(
        operationId: string,
        context: AuditContext,
        error: unknown,
    ): Promise<void> {
        try {
            await this.audit.record({
                ...this.base(operationId, context),
                outcome: 'failed',
                before: null,
                after: null,
                failure:
                    error instanceof Failure
                        ? error.code + (error.reason ? ':' + error.reason : '')
                        : 'error',
            });
        } catch {
            // Justified: an unavailable audit store must not replace the original business error.
        }
    }

    private base(operationId: string, context: AuditContext) {
        return {
            operationId,
            category: context.category,
            actorId: context.actorId,
            occurredAt: this.clock.now().toISOString(),
            subjectType: context.subjectType,
            subjectId: context.subjectId,
        };
    }
}
