import { describe, expect, it } from 'vitest';
import { MemoryUsers, passwords, tokens, user } from '../testing/identity-doubles.test-support.js';
import { Login } from './login.usecase.js';

describe('Login', () => {
    it('normalizes the username and issues restricted session claims', async () => {
        const users = new MemoryUsers();

        await users.create(user({ mustChangePassword: true }));
        const subject = new Login(users, passwords, tokens);

        const result = await subject.execute(' OWNER ', 'old-password');

        expect(result.actor.mustChangePassword).toBe(true);
        expect(JSON.parse(result.token)).toEqual({ userId: 'owner', version: 0, restricted: true });
    });
    it('rejects a missing user', async () => {
        const username = 'missing';
        const password = 'old-password';
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new Login(users, passwords, tokens);

        const result = subject.execute(username, password);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
    it('rejects an incorrect password', async () => {
        const username = 'owner';
        const password = 'wrong';
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new Login(users, passwords, tokens);

        const result = subject.execute(username, password);

        await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
    });
});
