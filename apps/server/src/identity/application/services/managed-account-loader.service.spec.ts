import { expect, it } from 'vitest';
import { IdentityDoubles, MemoryUsers } from '../testing/identity-doubles.test-support.js';
import { ManagedAccountLoader } from './managed-account-loader.service.js';

it('loads an account the administrator may manage', async () => {
    const users = new MemoryUsers();

    await users.create(IdentityDoubles.user({ id: 'guest', username: 'guest', role: 'guest' }));

    const result = await new ManagedAccountLoader(users).load('guest');

    expect(result.actor.id).toBe('guest');
});
it('reports a missing account', async () => {
    const subject = new ManagedAccountLoader(new MemoryUsers());

    const result = subject.load('missing');

    await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'account-missing' });
});
it('protects the first administrator', async () => {
    const users = new MemoryUsers();

    await users.create(IdentityDoubles.user({ role: 'admin' }));

    const result = new ManagedAccountLoader(users).load('owner');

    await expect(result).rejects.toMatchObject({ reason: 'protected-administrator' });
});
