import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { describe, expect, it } from 'vitest';
import {
    IdentityDoubles,
    MemoryUsers,
    passwords,
    tokens,
} from '../testing/identity-doubles.test-support.js';
import { Login } from './login.usecase.js';

describe('Login', () => {
    it('trims spaces around the username and issues restricted session claims', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user({ mustChangePassword: true }));
        const subject = new Login(
            users,
            passwords,
            tokens,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = await subject.execute(' owner ', 'old-password');

        expect(result.actor.mustChangePassword).toBe(true);
        expect(JSON.parse(result.token)).toEqual({ userId: 'owner', version: 0, restricted: true });
    });
    it('requires the exact letter case of the username', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user());
        const subject = new Login(
            users,
            passwords,
            tokens,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute('OWNER', 'old-password');

        await expect(result).rejects.toMatchObject({
            code: 'unauthorized',
            reason: 'credentials-incorrect',
        });
    });
    it('requires the exact letter case of the password', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user());
        const subject = new Login(
            users,
            passwords,
            tokens,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute('owner', 'OLD-PASSWORD');

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
    it('rejects a missing user', async () => {
        const username = 'missing';
        const password = 'old-password';
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user());
        const subject = new Login(
            users,
            passwords,
            tokens,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute(username, password);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
    it('rejects an incorrect password', async () => {
        const username = 'owner';
        const password = 'wrong';
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user());
        const subject = new Login(
            users,
            passwords,
            tokens,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute(username, password);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
});

describe('Login of deactivated accounts and audit', () => {
    it('refuses a deactivated account like wrong credentials', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user({ role: 'owner', active: false }));
        const subject = new Login(
            users,
            passwords,
            tokens,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute('owner', 'old-password');

        await expect(result).rejects.toMatchObject({
            code: 'unauthorized',
            reason: 'credentials-incorrect',
        });
    });
    it('records a successful sign-in for the account', async () => {
        const users = new MemoryUsers();
        const trail = new MemoryAuditTrail();

        await users.create(IdentityDoubles.user());
        const subject = new Login(users, passwords, tokens, AuditDoubles.auditedOperation(trail));

        await subject.execute('owner', 'old-password');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'authentication.signed-in',
                outcome: 'successful',
                actorId: 'owner',
            }),
        ]);
    });
    it('records a failed sign-in of an unknown username without an actor', async () => {
        const users = new MemoryUsers();
        const trail = new MemoryAuditTrail();
        const subject = new Login(users, passwords, tokens, AuditDoubles.auditedOperation(trail));

        await subject.execute('nobody', 'secret-guess').catch(() => undefined);

        expect(trail.entries).toEqual([
            expect.objectContaining({
                outcome: 'failed',
                actorId: null,
                failure: 'unauthorized:credentials-incorrect',
            }),
        ]);
        expect(JSON.stringify(trail.entries)).not.toContain('secret-guess');
    });
});
