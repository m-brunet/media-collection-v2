import { expect, it } from 'vitest';
import { LibraryAdministratorLookup } from './library-administrator-lookup.service.js';
import { MemoryUsers, user } from '../testing/identity-doubles.test-support.js';

it('finds the protected administrator among the accounts', async () => {
    const users = new MemoryUsers();

    await users.create(user({ id: 'owner', username: 'owner', role: 'owner' }));
    await users.create(user({ id: 'admin', username: 'admin', language: 'fr' }));
    const subject = new LibraryAdministratorLookup(users);

    const result = await subject.find();

    expect(result).toEqual({
        id: 'admin',
        username: 'admin',
        role: 'admin',
        mustChangePassword: false,
        language: 'fr',
    });
});
it('finds nobody before the setup is completed', async () => {
    const subject = new LibraryAdministratorLookup(new MemoryUsers());

    const result = await subject.find();

    expect(result).toBeNull();
});
