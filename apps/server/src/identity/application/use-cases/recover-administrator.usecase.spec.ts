import { describe, expect, it } from 'vitest';
import {
    IdentityDoubles,
    MemoryUsers,
    passwords,
} from '../testing/identity-doubles.test-support.js';
import { RecoverAdministrator } from './recover-administrator.usecase.js';

describe('RecoverAdministrator', () => {
    it('resets an existing administrator and requires setup again', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user({ tokenVersion: 1 }));
        const subject = new RecoverAdministrator(users, passwords);

        await subject.execute(' owner ', 'recovered-password');

        expect((await users.findById('owner'))!.snapshot).toMatchObject({
            passwordHash: 'hash:recovered-password',
            tokenVersion: 2,
            mustChangePassword: true,
        });
    });
    it('rejects a missing account', async () => {
        const username = 'missing';
        const users = new MemoryUsers();

        await users.create(
            IdentityDoubles.user({ id: 'member', username: 'member', role: 'owner' }),
        );
        const subject = new RecoverAdministrator(users, passwords);

        const result = subject.execute(username, 'recovered-password');

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
    it('rejects a non-administrator account', async () => {
        const username = 'member';
        const users = new MemoryUsers();

        await users.create(
            IdentityDoubles.user({ id: 'member', username: 'member', role: 'owner' }),
        );
        const subject = new RecoverAdministrator(users, passwords);

        const result = subject.execute(username, 'recovered-password');

        await expect(result).rejects.toMatchObject({ code: 'not_found' });
    });
    it('rejects a short recovery password', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user());
        const subject = new RecoverAdministrator(users, passwords);

        const result = subject.execute('owner', 'short');

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    });
});
