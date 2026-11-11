export type AuditOutcome = 'successful' | 'failed';

export interface AuditEntry {
    operationId: string;
    category: string;
    outcome: AuditOutcome;
    actorId: string | null;
    occurredAt: string;
    subjectType: string;
    subjectId: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    failure: string | null;
}

export type RelatedChange = Pick<AuditEntry, 'category' | 'subjectType' | 'before' | 'after'> & {
    subjectId: string;
};
