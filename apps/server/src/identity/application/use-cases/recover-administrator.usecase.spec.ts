import { describe, expect, it } from 'vitest';
import { MemoryUsers, passwords, user } from '../testing/identity-doubles.test-support.js';
import { RecoverAdministrator } from './recover-administrator.usecase.js';

describe('RecoverAdministrator', () => {
    it('resets an existing administrator and requires setup again', async () => {
        const users = new MemoryUsers();

        await users.create(user({ tokenVersion: 1 }));
        const subject = new RecoverAdministrator(users, passwords);

        await subject.execute(' OWNER ', 'recovered-password');

        expect((await users.findById('owner'))!.snapshot).toMatchObject({
            passwordHash: 'hash:recovered-password',
            tokenVersion: 2,
            mustChangePassword: true
        });
    });
    it('rejects a missing account', async () => {
        const username = 'missing';
        const users = new MemoryUsers();

        await users.create(user({ id: 'member', username: 'member', role: 'user' }));
        const subject = new RecoverAdministrator(users, passwords);

        const result = subject.execute(username, 'recovered-password');

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
    it('rejects a non-administrator account', async () => {
        const username = 'member';
        const users = new MemoryUsers();

        await users.create(user({ id: 'member', username: 'member', role: 'user' }));
        const subject = new RecoverAdministrator(users, passwords);

        const result = subject.execute(username, 'recovered-password');

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
    it('rejects a short recovery password', async () => {
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new RecoverAdministrator(users, passwords);

        const result = subject.execute('owner', 'short');

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    });
});
