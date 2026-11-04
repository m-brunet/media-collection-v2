import { describe, expect, it } from 'vitest';
import {
    auditedOperation,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import {
    clock,
    MemoryUsers,
    passwords,
    tokens,
    user,
} from '../testing/identity-doubles.test-support.js';
import { CompleteSetup } from './complete-setup.usecase.js';

function subject(users = new MemoryUsers(), trail = new MemoryAuditTrail()) {
    return new CompleteSetup(
        users,
        passwords,
        tokens,
        { next: () => 'first' },
        clock,
        auditedOperation(trail),
    );
}

describe('CompleteSetup', () => {
    it('creates the protected administrator with the chosen password', async () => {
        const users = new MemoryUsers();

        const result = await subject(users).execute({
            username: ' Alex ',
            password: 'chosen-password',
        });

        expect(result.actor).toMatchObject({ id: 'first', username: 'alex', role: 'admin' });
        expect((await users.findById('first'))!.snapshot).toMatchObject({
            passwordHash: 'hash:chosen-password',
            mustChangePassword: false,
            active: true,
        });
    });
    it('signs the administrator in', async () => {
        const users = new MemoryUsers();

        const result = await subject(users).execute({
            username: 'alex',
            password: 'chosen-password',
        });

        expect(JSON.parse(result.token)).toEqual({
            userId: 'first',
            version: 0,
            restricted: false,
        });
    });
    it('records the setup without the password', async () => {
        const trail = new MemoryAuditTrail();

        await subject(new MemoryUsers(), trail).execute({
            username: 'alex',
            password: 'chosen-password',
        });

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'setup.administrator-created',
                outcome: 'successful',
                actorId: 'first',
                subjectId: 'first',
            }),
        ]);
        expect(JSON.stringify(trail.entries)).not.toContain('chosen-password');
    });
    it('refuses a second setup once an account exists', async () => {
        const users = new MemoryUsers();

        await users.create(user());

        const result = subject(users).execute({
            username: 'intruder',
            password: 'chosen-password',
        });

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'setup-completed' });
        expect(await users.list()).toHaveLength(1);
    });
    it('rejects a short password', async () => {
        const users = new MemoryUsers();

        const result = subject(users).execute({ username: 'alex', password: 'short' });

        await expect(result).rejects.toMatchObject({ reason: 'password-length' });
        expect(await users.list()).toEqual([]);
    });
});
