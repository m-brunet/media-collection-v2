import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { describe, expect, it } from 'vitest';
import {
    IdentityDoubles,
    MemoryUsers,
    passwords,
} from '../testing/identity-doubles.test-support.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../services/current-password-confirmation.service.js';
import { ChangePassword } from './change-password.usecase.js';

describe('ChangePassword', () => {
    it('persists a new hash, completes setup, and invalidates old sessions', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user({ mustChangePassword: true });

        await users.create(account);
        const subject = new ChangePassword(
            users,
            new AccountLoader(users),
            passwords,
            new CurrentPasswordConfirmation(passwords),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = await subject.execute(account.actor, 'old-password', 'new-password');

        expect(result.mustChangePassword).toBe(false);
        expect((await users.findById('owner'))!.snapshot).toMatchObject({
            passwordHash: 'hash:new-password',
            tokenVersion: 1,
        });
    });
    it('rejects an incorrect current password', async () => {
        const current = 'wrong';
        const next = 'new-password';
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        const subject = new ChangePassword(
            users,
            new AccountLoader(users),
            passwords,
            new CurrentPasswordConfirmation(passwords),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute(account.actor, current, next);

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
        expect((await users.findById('owner'))!.snapshot.tokenVersion).toBe(0);
    });
    it('rejects a short replacement password', async () => {
        const current = 'old-password';
        const next = 'short';
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        const subject = new ChangePassword(
            users,
            new AccountLoader(users),
            passwords,
            new CurrentPasswordConfirmation(passwords),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute(account.actor, current, next);

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
        expect((await users.findById('owner'))!.snapshot.tokenVersion).toBe(0);
    });
    it('rejects an unchanged password', async () => {
        const current = 'old-password';
        const next = 'old-password';
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        const subject = new ChangePassword(
            users,
            new AccountLoader(users),
            passwords,
            new CurrentPasswordConfirmation(passwords),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute(account.actor, current, next);

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
        expect((await users.findById('owner'))!.snapshot.tokenVersion).toBe(0);
    });
});
