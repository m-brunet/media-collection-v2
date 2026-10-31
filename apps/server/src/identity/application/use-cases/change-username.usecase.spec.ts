import { describe, expect, it } from 'vitest';
import { MemoryUsers, passwords, user } from '../testing/identity-doubles.test-support.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../services/current-password-confirmation.service.js';
import { ChangeUsername } from './change-username.usecase.js';

describe('ChangeUsername', () => {
    it('normalizes a new username while preserving mandatory setup', async () => {
        const users = new MemoryUsers();
        const account = user({ mustChangePassword: true });

        await users.create(account);
        const subject = new ChangeUsername(
            users,
            new AccountLoader(users),
            new CurrentPasswordConfirmation(passwords)
        );

        const result = await subject.execute(account.actor, ' Renamed ', 'old-password');

        expect(result).toMatchObject({ username: 'renamed', mustChangePassword: true });
        expect((await users.findById('owner'))!.actor.username).toBe('renamed');
    });
    it('rejects an incorrect current password', async () => {
        const username = 'renamed';
        const password = 'wrong';
        const code = 'invalid_input';
        const users = new MemoryUsers();
        const account = user();

        await users.create(account);
        await users.create(user({ id: 'other', username: 'taken' }));
        const subject = new ChangeUsername(
            users,
            new AccountLoader(users),
            new CurrentPasswordConfirmation(passwords)
        );

        const result = subject.execute(account.actor, username, password);

        await expect(result).rejects.toMatchObject({ code });
        expect((await users.findById('owner'))!.actor.username).toBe('owner');
    });
    it('rejects an invalid username', async () => {
        const username = '!';
        const password = 'old-password';
        const code = 'invalid_input';
        const users = new MemoryUsers();
        const account = user();

        await users.create(account);
        await users.create(user({ id: 'other', username: 'taken' }));
        const subject = new ChangeUsername(
            users,
            new AccountLoader(users),
            new CurrentPasswordConfirmation(passwords)
        );

        const result = subject.execute(account.actor, username, password);

        await expect(result).rejects.toMatchObject({ code });
        expect((await users.findById('owner'))!.actor.username).toBe('owner');
    });
    it('rejects a duplicate username', async () => {
        const username = 'taken';
        const password = 'old-password';
        const code = 'conflict';
        const users = new MemoryUsers();
        const account = user();

        await users.create(account);
        await users.create(user({ id: 'other', username: 'taken' }));
        const subject = new ChangeUsername(
            users,
            new AccountLoader(users),
            new CurrentPasswordConfirmation(passwords)
        );

        const result = subject.execute(account.actor, username, password);

        await expect(result).rejects.toMatchObject({ code });
        expect((await users.findById('owner'))!.actor.username).toBe('owner');
    });
});
