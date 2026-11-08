import { describe, expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import {
    clock,
    IdentityDoubles,
    MemoryUsers,
    passwords,
} from '../testing/identity-doubles.test-support.js';
import { CreateUser } from './create-user.usecase.js';

function subject(users = new MemoryUsers(), trail = new MemoryAuditTrail()) {
    return new CreateUser(
        users,
        passwords,
        { next: () => 'member' },
        clock,
        AuditDoubles.auditedOperation(trail),
    );
}

const administrator = IdentityDoubles.user().actor;

describe('CreateUser', () => {
    it('creates an Owner account requiring password replacement', async () => {
        const users = new MemoryUsers();
        const input = {
            username: ' Member ',
            password: 'temporary-password',
            role: 'owner' as const,
        };

        const result = await subject(users).execute(administrator, input);

        expect(result).toEqual({
            id: 'member',
            username: 'Member',
            role: 'owner',
            mustChangePassword: true,
            active: true,
        });
        expect((await users.findById('member'))!.snapshot.passwordHash).toBe(
            'hash:temporary-password',
        );
    });
    it('creates a Guest account', async () => {
        const users = new MemoryUsers();
        const input = {
            username: 'friend',
            password: 'temporary-password',
            role: 'guest' as const,
        };

        const result = await subject(users).execute(administrator, input);

        expect(result.role).toBe('guest');
    });
    it('starts the new account without a chosen language', async () => {
        const users = new MemoryUsers();
        const input = {
            username: 'friend',
            password: 'temporary-password',
            role: 'guest' as const,
        };

        await subject(users).execute(administrator, input);

        expect((await users.findById('member'))!.actor.language).toBeNull();
    });
    it('records the creation without the password', async () => {
        const trail = new MemoryAuditTrail();
        const input = {
            username: 'member',
            password: 'temporary-password',
            role: 'owner' as const,
        };

        await subject(new MemoryUsers(), trail).execute(administrator, input);

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.created',
                outcome: 'successful',
                actorId: 'owner',
                subjectId: 'member',
                after: {
                    id: 'member',
                    username: 'member',
                    role: 'owner',
                    mustChangePassword: true,
                    active: true,
                },
            }),
        ]);
        expect(JSON.stringify(trail.entries)).not.toContain('temporary-password');
    });
    it('refuses to create another administrator', async () => {
        const users = new MemoryUsers();
        const input = {
            username: 'second',
            password: 'temporary-password',
            role: 'admin' as 'owner',
        };

        const result = subject(users).execute(administrator, input);

        await expect(result).rejects.toMatchObject({
            code: 'invalid_input',
            reason: 'role-required',
        });
        expect(await users.list()).toEqual([]);
    });
    it('rejects a short password', async () => {
        const users = new MemoryUsers();
        const input = { username: 'member', password: 'short', role: 'owner' as const };

        const result = subject(users).execute(administrator, input);

        await expect(result).rejects.toMatchObject({ reason: 'password-length' });
        expect(await users.list()).toEqual([]);
    });
    it('rejects an invalid username', async () => {
        const users = new MemoryUsers();
        const input = { username: '!', password: 'temporary-password', role: 'owner' as const };

        const result = subject(users).execute(administrator, input);

        await expect(result).rejects.toMatchObject({ reason: 'username-format' });
    });
    it('rejects an owner creating accounts', async () => {
        const users = new MemoryUsers();
        const input = {
            username: 'member',
            password: 'temporary-password',
            role: 'owner' as const,
        };

        const result = subject(users).execute(IdentityDoubles.user({ role: 'owner' }).actor, input);

        await expect(result).rejects.toMatchObject({ code: 'forbidden', reason: 'admin-only' });
        expect(await users.list()).toEqual([]);
    });
    it('records a refused creation as Failed', async () => {
        const trail = new MemoryAuditTrail();
        const input = {
            username: 'member',
            password: 'temporary-password',
            role: 'owner' as const,
        };

        await subject(new MemoryUsers(), trail)
            .execute(IdentityDoubles.user({ role: 'guest' }).actor, input)
            .catch(() => undefined);

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.created',
                outcome: 'failed',
                after: null,
                failure: 'forbidden:admin-only',
            }),
        ]);
    });
    it('rejects an administrator who has not replaced a temporary password', async () => {
        const users = new MemoryUsers();
        const input = {
            username: 'member',
            password: 'temporary-password',
            role: 'owner' as const,
        };

        const result = subject(users).execute(
            IdentityDoubles.user({ mustChangePassword: true }).actor,
            input,
        );

        await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
    });
});
