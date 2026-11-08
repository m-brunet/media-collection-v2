import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { describe, expect, it } from 'vitest';
import { IdentityDoubles, MemoryUsers } from '../testing/identity-doubles.test-support.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { ChangeLanguage } from './change-language.usecase.js';

describe('ChangeLanguage', () => {
    it('saves the chosen language for the signed-in account', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        const subject = new ChangeLanguage(
            users,
            new AccountLoader(users),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = await subject.execute(account.actor, 'fr');

        expect(result.language).toBe('fr');
        expect((await users.findById('owner'))!.actor.language).toBe('fr');
    });
    it('does not change another account', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        await users.create(IdentityDoubles.user({ id: 'other', username: 'other' }));
        const subject = new ChangeLanguage(
            users,
            new AccountLoader(users),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        await subject.execute(account.actor, 'fr');

        expect((await users.findById('other'))!.actor.language).toBeNull();
    });
    it('keeps the restricted state of a temporary-password session', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        const subject = new ChangeLanguage(
            users,
            new AccountLoader(users),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = await subject.execute({ ...account.actor, mustChangePassword: true }, 'en');

        expect(result).toMatchObject({ language: 'en', mustChangePassword: true });
    });
    it('does not end existing sessions', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user();

        await users.create(account);
        const subject = new ChangeLanguage(
            users,
            new AccountLoader(users),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        await subject.execute(account.actor, 'fr');

        expect((await users.findById('owner'))!.snapshot.tokenVersion).toBe(0);
    });
    it('rejects an unknown account', async () => {
        const users = new MemoryUsers();
        const subject = new ChangeLanguage(
            users,
            new AccountLoader(users),
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute(IdentityDoubles.user().actor, 'fr');

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
});
