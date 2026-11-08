import { describe, expect, it } from 'vitest';
import { IdentityDoubles, MemoryUsers, tokens } from '../testing/identity-doubles.test-support.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { RenewSession } from './renew-session.usecase.js';

describe('RenewSession', () => {
    it('issues current account claims', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user({ tokenVersion: 2 });

        await users.create(account);
        const subject = new RenewSession(new AccountLoader(users), tokens);
        const actor = { ...account.actor, sessionVersion: 2 };

        const result = await subject.renew(actor);

        expect(JSON.parse(result)).toEqual({ userId: 'owner', version: 2, restricted: false });
    });
    it('refuses renewal from a stale authenticated actor', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user({ tokenVersion: 2 }));
        const subject = new RenewSession(new AccountLoader(users), tokens);
        const actor = { ...IdentityDoubles.user().actor, sessionVersion: 1 };

        const result = subject.renew(actor);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
    it('issues current claims when the actor has no prior session version', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user({ tokenVersion: 3 });

        await users.create(account);
        const subject = new RenewSession(new AccountLoader(users), tokens);

        const result = await subject.renew(account.actor);

        expect(JSON.parse(result)).toEqual({ userId: 'owner', version: 3, restricted: false });
    });
    it('preserves password-change restrictions in renewed claims', async () => {
        const users = new MemoryUsers();
        const account = IdentityDoubles.user({ mustChangePassword: true, tokenVersion: 3 });

        await users.create(account);
        const subject = new RenewSession(new AccountLoader(users), tokens);

        const result = await subject.renew(account.actor);

        expect(JSON.parse(result)).toEqual({ userId: 'owner', version: 3, restricted: true });
    });
    it('rejects renewal when the account no longer exists', async () => {
        const users = new MemoryUsers();
        const subject = new RenewSession(new AccountLoader(users), tokens);

        const result = subject.renew(IdentityDoubles.user().actor);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
});
