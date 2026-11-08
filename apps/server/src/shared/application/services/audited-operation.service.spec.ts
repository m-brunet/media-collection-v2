import { expect, it } from 'vitest';
import { Failure } from '../../domain/exceptions/failure.js';
import { AuditDoubles, MemoryAuditTrail } from '../testing/audit-doubles.test-support.js';

const context = () => ({
    category: 'account.created',
    actorId: 'admin',
    subjectType: 'account',
    subjectId: null,
});

it('returns the result of a successful change', async () => {
    const subject = AuditDoubles.auditedOperation(new MemoryAuditTrail());

    const result = await subject.run(context(), async () => ({
        result: 'created',
        before: null,
        after: { username: 'sam' },
    }));

    expect(result).toBe('created');
});

it('records a Successful entry with the before and after values', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

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
    const subject = AuditDoubles.auditedOperation(trail);

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
    const subject = AuditDoubles.auditedOperation(new MemoryAuditTrail());
    const failure = new Failure('conflict', 'Taken', 'username-taken');

    const result = subject.run(context(), async () => {
        throw failure;
    });

    await expect(result).rejects.toBe(failure);
});

it('records a Failed entry without any after-state', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

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
    const subject = AuditDoubles.auditedOperation(trail);

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
    const subject = AuditDoubles.auditedOperation({
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

const batch = (subjectIds: string[] = ['dune', 'piranesi']) => ({
    category: 'loan.lent',
    actorId: 'owner',
    subjectType: 'book',
    subjectIds,
});

const lentBoth = async () => ({
    result: 'lent',
    entries: [
        { subjectId: 'dune', before: { loan: null }, after: { loan: { receiver: 'Sam' } } },
        { subjectId: 'piranesi', before: { loan: null }, after: { loan: { receiver: 'Sam' } } },
    ],
});

it('returns the result of a successful batch', async () => {
    const subject = AuditDoubles.auditedOperation(new MemoryAuditTrail());

    const result = await subject.runBatch(batch(), lentBoth);

    expect(result).toBe('lent');
});

it('records one Successful entry per subject of a batch, sharing its operation', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

    await subject.runBatch(batch(), lentBoth);

    expect(trail.entries).toEqual([
        {
            operationId: 'operation-1',
            category: 'loan.lent',
            outcome: 'successful',
            actorId: 'owner',
            occurredAt: '2026-01-01T00:00:00.000Z',
            subjectType: 'book',
            subjectId: 'dune',
            before: { loan: null },
            after: { loan: { receiver: 'Sam' } },
            failure: null,
        },
        {
            operationId: 'operation-1',
            category: 'loan.lent',
            outcome: 'successful',
            actorId: 'owner',
            occurredAt: '2026-01-01T00:00:00.000Z',
            subjectType: 'book',
            subjectId: 'piranesi',
            before: { loan: null },
            after: { loan: { receiver: 'Sam' } },
            failure: null,
        },
    ]);
});

it('records the related changes of a batch under the same operation and actor', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

    await subject.runBatch(batch(['dune']), async () => ({
        result: undefined,
        entries: [{ subjectId: 'dune', before: null, after: { lent: true } }],
        related: [
            {
                category: 'receiver.created',
                subjectType: 'receiver',
                subjectId: 'sam',
                before: null,
                after: { name: 'Sam' },
            },
        ],
    }));

    expect(trail.entries[1]).toEqual({
        operationId: 'operation-1',
        category: 'receiver.created',
        outcome: 'successful',
        actorId: 'owner',
        occurredAt: '2026-01-01T00:00:00.000Z',
        subjectType: 'receiver',
        subjectId: 'sam',
        before: null,
        after: { name: 'Sam' },
        failure: null,
    });
});

it('rethrows a failed batch', async () => {
    const subject = AuditDoubles.auditedOperation(new MemoryAuditTrail());
    const failure = new Failure('conflict', 'Lent', 'book-already-lent');

    const result = subject.runBatch(batch(), async () => {
        throw failure;
    });

    await expect(result).rejects.toBe(failure);
});

it('records a Failed entry for every requested subject of a failed batch, sharing its operation', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

    await subject
        .runBatch(batch(), async () => {
            throw new Failure('conflict', 'Lent', 'book-already-lent');
        })
        .catch(() => undefined);

    expect(trail.entries).toEqual([
        expect.objectContaining({
            operationId: 'operation-1',
            outcome: 'failed',
            subjectId: 'dune',
            before: null,
            after: null,
            failure: 'conflict:book-already-lent',
        }),
        expect.objectContaining({
            operationId: 'operation-1',
            outcome: 'failed',
            subjectId: 'piranesi',
            before: null,
            after: null,
            failure: 'conflict:book-already-lent',
        }),
    ]);
});

it('keeps only the Failed entries of a batch that fails after recording', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

    await subject
        .runBatch(batch(['dune']), async () => {
            await trail.record({
                operationId: 'inner',
                category: 'receiver.created',
                outcome: 'successful',
                actorId: 'owner',
                occurredAt: '2026-01-01T00:00:00.000Z',
                subjectType: 'receiver',
                subjectId: 'sam',
                before: null,
                after: { name: 'Sam' },
                failure: null,
            });
            throw new Error('Storage failed');
        })
        .catch(() => undefined);

    expect(trail.entries.map((entry) => entry.outcome + ':' + entry.subjectId)).toEqual([
        'failed:dune',
    ]);
});

it('records one Failed entry without a subject when a failed batch requested none', async () => {
    const trail = new MemoryAuditTrail();
    const subject = AuditDoubles.auditedOperation(trail);

    await subject
        .runBatch(batch([]), async () => {
            throw new Failure('invalid_input', 'Empty', 'selection-empty');
        })
        .catch(() => undefined);

    expect(trail.entries).toEqual([
        expect.objectContaining({
            outcome: 'failed',
            subjectId: null,
            failure: 'invalid_input:selection-empty',
        }),
    ]);
});

it('keeps the original error of a batch when the audit store is unavailable', async () => {
    const failure = new Failure('conflict', 'Lent', 'book-already-lent');
    const subject = AuditDoubles.auditedOperation({
        entries: [],
        record: async () => {
            throw new Error('Audit store unavailable');
        },
        run: async (work: () => Promise<unknown>) => work(),
    } as unknown as MemoryAuditTrail);

    const result = subject.runBatch(batch(), async () => {
        throw failure;
    });

    await expect(result).rejects.toBe(failure);
});
