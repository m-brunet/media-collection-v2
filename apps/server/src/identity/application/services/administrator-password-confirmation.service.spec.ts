import { expect, it } from 'vitest';
import { AdministratorPasswordConfirmation } from './administrator-password-confirmation.service.js';
import {
    IdentityDoubles,
    MemoryUsers,
    passwords,
} from '../testing/identity-doubles.test-support.js';

it('accepts the current password of the account', async () => {
    const users = new MemoryUsers();

    await users.create(IdentityDoubles.user({ id: 'admin', username: 'admin' }));
    const subject = new AdministratorPasswordConfirmation(users, passwords);

    const result = subject.confirm('admin', 'old-password');

    await expect(result).resolves.toBeUndefined();
});
it('rejects another password', async () => {
    const users = new MemoryUsers();

    await users.create(IdentityDoubles.user({ id: 'admin', username: 'admin' }));
    const subject = new AdministratorPasswordConfirmation(users, passwords);

    const result = subject.confirm('admin', 'wrong-password');

    await expect(result).rejects.toMatchObject({ reason: 'password-incorrect' });
});
it('rejects an unknown account', async () => {
    const subject = new AdministratorPasswordConfirmation(new MemoryUsers(), passwords);

    const result = subject.confirm('missing', 'old-password');

    await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
});
