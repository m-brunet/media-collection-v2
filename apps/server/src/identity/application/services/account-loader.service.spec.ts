import { expect, it } from 'vitest';
import { AccountLoader } from './account-loader.service.js';
import { MemoryUsers, user } from '../testing/identity-doubles.test-support.js';

it('loads an existing account', async () => {
    const users = new MemoryUsers();

    await users.create(user());
    const subject = new AccountLoader(users);

    const result = await subject.load('owner');

    expect(result.actor.id).toBe('owner');
});
it('rejects an absent account as unauthorized', async () => {
    const subject = new AccountLoader(new MemoryUsers());
    const id = 'absent';

    const result = subject.load(id);

    await expect(result).rejects.toMatchObject({ code: 'unauthorized' });
});
