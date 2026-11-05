export type AuditOutcome = 'successful' | 'failed';

// One technical audit record of a user-initiated state change. Before/after values describe the
// affected record and must never contain credentials. Failed entries carry no after-state.
export interface AuditEntry {
    operationId: string;
    category: string;
    outcome: AuditOutcome;
    // The acting account; null only when no account could be identified (for example an unknown sign-in).
    actorId: string | null;
    occurredAt: string;
    subjectType: string;
    subjectId: string | null;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    // Failure code and reason of a Failed entry, for example `conflict:username-taken`.
    failure: string | null;
}

// A change an operation made to another subject as a consequence (for example a collection
// created by saving a book). It is recorded with the operation's ID and actor.
export type RelatedChange = Pick<AuditEntry, 'category' | 'subjectType' | 'before' | 'after'> & {
    subjectId: string;
};
