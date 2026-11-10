import type { RelatedChange } from '../ports/driven/audit-entry.interface.js';
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
    related?: readonly RelatedChange[];
}

// What a multi-record operation is about: one record per subject (for example each book of a
// lending), all sharing one operation ID. The subjects are those requested, so each one gets a
// Failed record if the operation fails.
export interface BatchAuditContext {
    category: string;
    actorId: string | null;
    subjectType: string;
    subjectIds: readonly string[];
}

export interface BatchEntry {
    subjectId: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
}

export interface AuditedBatchChange<T> {
    result: T;
    entries: readonly BatchEntry[];
    related?: readonly RelatedChange[];
}

// Runs a user-initiated state change atomically with its Successful audit records. If the change
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

                await this.recordSuccess(operationId, context, outcome);
                await this.recordRelated(operationId, context.actorId, outcome.related);

                return outcome.result;
            });
        } catch (error) {
            await this.recordFailures(operationId, [context], error);

            throw error;
        }
    }

    // Runs a change affecting several subjects atomically, with one Successful record per subject.
    // If it fails, nothing of it persists and every requested subject gets a Failed record, even
    // those that were not themselves the cause: the batch as a whole was not committed.
    async runBatch<T>(
        context: BatchAuditContext,
        change: () => Promise<AuditedBatchChange<T>>,
    ): Promise<T> {
        const operationId = this.ids.next();
        const subject = (subjectId: string | null): AuditContext => ({
            category: context.category,
            actorId: context.actorId,
            subjectType: context.subjectType,
            subjectId,
        });

        try {
            return await this.transactions.run(async () => {
                const outcome = await change();

                for (const entry of outcome.entries) {
                    await this.recordSuccess(operationId, subject(entry.subjectId), entry);
                }

                await this.recordRelated(operationId, context.actorId, outcome.related);

                return outcome.result;
            });
        } catch (error) {
            const subjects =
                context.subjectIds.length > 0 ? context.subjectIds.map(subject) : [subject(null)];

            await this.recordFailures(operationId, subjects, error);

            throw error;
        }
    }

    private async recordSuccess(
        operationId: string,
        context: AuditContext,
        snapshots: Pick<AuditedChange<unknown>, 'before' | 'after'>,
    ): Promise<void> {
        await this.audit.record({
            ...this.base(operationId, context),
            outcome: 'successful',
            before: snapshots.before,
            after: snapshots.after,
            failure: null,
        });
    }

    private async recordRelated(
        operationId: string,
        actorId: string | null,
        related: readonly RelatedChange[] | undefined,
    ): Promise<void> {
        for (const change of related ?? []) {
            await this.recordSuccess(
                operationId,
                {
                    category: change.category,
                    actorId,
                    subjectType: change.subjectType,
                    subjectId: change.subjectId,
                },
                change,
            );
        }
    }

    private async recordFailures(
        operationId: string,
        contexts: readonly AuditContext[],
        error: unknown,
    ): Promise<void> {
        const failure = Failure.auditCode(error);

        try {
            for (const context of contexts) {
                await this.audit.record({
                    ...this.base(operationId, context),
                    outcome: 'failed',
                    before: null,
                    after: null,
                    failure,
                });
            }
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
