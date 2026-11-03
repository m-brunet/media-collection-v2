import { describe, expect, it } from 'vitest';
import { MemoryUsers, tokens, user } from '../testing/identity-doubles.test-support.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { AuthenticateSession } from './authenticate-session.usecase.js';

describe('AuthenticateSession', () => {
    it('preserves an unrestricted token', async () => {
        const restricted = false;
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new AuthenticateSession(new AccountLoader(users), tokens);
        const token = JSON.stringify({ userId: 'owner', version: 0, restricted });

        const result = await subject.authenticate(token);

        expect(result).toMatchObject({
            id: 'owner',
            sessionVersion: 0,
            mustChangePassword: restricted,
        });
    });
    it('preserves a restricted token', async () => {
        const restricted = true;
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new AuthenticateSession(new AccountLoader(users), tokens);
        const token = JSON.stringify({ userId: 'owner', version: 0, restricted });

        const result = await subject.authenticate(token);

        expect(result).toMatchObject({
            id: 'owner',
            sessionVersion: 0,
            mustChangePassword: restricted,
        });
    });
    it('preserves mandatory setup even for an unrestricted token', async () => {
        const users = new MemoryUsers();

        await users.create(user({ mustChangePassword: true }));
        const subject = new AuthenticateSession(new AccountLoader(users), tokens);
        const token = JSON.stringify({ userId: 'owner', version: 0, restricted: false });

        const result = await subject.authenticate(token);

        expect(result.mustChangePassword).toBe(true);
    });
    it('rejects an expired session', async () => {
        const token = 'expired';
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new AuthenticateSession(new AccountLoader(users), tokens);

        const result = subject.authenticate(token);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
    it('rejects a session for a missing user', async () => {
        const token = JSON.stringify({ userId: 'absent', version: 0, restricted: false });
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new AuthenticateSession(new AccountLoader(users), tokens);

        const result = subject.authenticate(token);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
    it('rejects a stale token version', async () => {
        const token = JSON.stringify({ userId: 'owner', version: -1, restricted: false });
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new AuthenticateSession(new AccountLoader(users), tokens);

        const result = subject.authenticate(token);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
});
