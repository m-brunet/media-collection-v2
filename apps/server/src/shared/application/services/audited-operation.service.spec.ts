import { expect, it } from 'vitest';
import { Failure } from '../../domain/exceptions/failure.js';
import { auditedOperation, MemoryAuditTrail } from '../testing/audit-doubles.test-support.js';

const context = () => ({
    category: 'account.created',
    actorId: 'admin',
    subjectType: 'account',
    subjectId: null,
});

it('returns the result of a successful change', async () => {
    const subject = auditedOperation(new MemoryAuditTrail());

    const result = await subject.run(context(), async () => ({
        result: 'created',
        before: null,
        after: { username: 'sam' },
    }));

    expect(result).toBe('created');
});

it('records a Successful entry with the before and after values', async () => {
    const trail = new MemoryAuditTrail();
    const subject = auditedOperation(trail);

    await subject.run(context(), async (current) => {
        current.subjectId = 'sam';

        return { result: undefined, before: { active: true }, after: { active: false } };
    });

    expect(trail.entries).toEqual([
        {
            operationId: 'operation-1',
            category: 'account.created',
            outcome: 'successful',
            actorId: 'admin',
            occurredAt: '2026-01-01T00:00:00.000Z',
            subjectType: 'account',
            subjectId: 'sam',
            before: { active: true },
            after: { active: false },
            failure: null,
        },
    ]);
});

it('records the related changes under the same operation and actor', async () => {
    const trail = new MemoryAuditTrail();
    const subject = auditedOperation(trail);

    await subject.run(context(), async () => ({
        result: undefined,
        before: null,
        after: { username: 'sam' },
        related: [
            {
                category: 'group.created',
                subjectType: 'group',
                subjectId: 'readers',
                before: null,
                after: { name: 'Readers' },
            },
        ],
    }));

    expect(trail.entries[1]).toEqual({
        operationId: 'operation-1',
        category: 'group.created',
        outcome: 'successful',
        actorId: 'admin',
        occurredAt: '2026-01-01T00:00:00.000Z',
        subjectType: 'group',
        subjectId: 'readers',
        before: null,
        after: { name: 'Readers' },
        failure: null,
    });
});

it('rethrows a failed change', async () => {
    const subject = auditedOperation(new MemoryAuditTrail());
    const failure = new Failure('conflict', 'Taken', 'username-taken');

    const result = subject.run(context(), async () => {
        throw failure;
    });

    await expect(result).rejects.toBe(failure);
});

it('records a Failed entry without any after-state', async () => {
    const trail = new MemoryAuditTrail();
    const subject = auditedOperation(trail);

    await subject
        .run(context(), async () => {
            throw new Failure('conflict', 'Taken', 'username-taken');
        })
        .catch(() => undefined);

    expect(trail.entries).toEqual([
        expect.objectContaining({
            outcome: 'failed',
            before: null,
            after: null,
            failure: 'conflict:username-taken',
        }),
    ]);
});

it('keeps the Failed entry while discarding everything recorded inside the failed change', async () => {
    const trail = new MemoryAuditTrail();
    const subject = auditedOperation(trail);

    await subject
        .run(context(), async () => {
            await trail.record({
                operationId: 'inner',
                category: 'partial',
                outcome: 'successful',
                actorId: 'admin',
                occurredAt: '2026-01-01T00:00:00.000Z',
                subjectType: 'account',
                subjectId: 'sam',
                before: null,
                after: { username: 'sam' },
                failure: null,
            });
            throw new Error('Storage failed');
        })
        .catch(() => undefined);

    expect(trail.entries.map((entry) => entry.outcome + ':' + entry.failure)).toEqual([
        'failed:error',
    ]);
});

it('keeps the original error when the audit store is unavailable', async () => {
    const failure = new Failure('forbidden', 'No');
    const subject = auditedOperation({
        entries: [],
        record: async () => {
            throw new Error('Audit store unavailable');
        },
        run: async (work: () => Promise<unknown>) => work(),
    } as unknown as MemoryAuditTrail);

    const result = subject.run(context(), async () => {
        throw failure;
    });

    await expect(result).rejects.toBe(failure);
});
