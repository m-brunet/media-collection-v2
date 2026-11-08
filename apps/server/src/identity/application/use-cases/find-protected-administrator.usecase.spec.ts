import { describe, expect, it } from 'vitest';
import { IdentityDoubles, MemoryUsers } from '../testing/identity-doubles.test-support.js';
import { FindProtectedAdministrator } from './find-protected-administrator.usecase.js';

describe('FindProtectedAdministrator', () => {
    it('gives the protected administrator username', async () => {
        const users = new MemoryUsers();

        await users.create(
            IdentityDoubles.user({ id: 'member', username: 'member', role: 'owner' }),
        );
        await users.create(IdentityDoubles.user({ id: 'admin', username: 'Alex' }));
        const subject = new FindProtectedAdministrator(users);

        const result = await subject.execute();

        expect(result).toEqual({ username: 'Alex' });
    });
    it('finds nobody before setup', async () => {
        const subject = new FindProtectedAdministrator(new MemoryUsers());

        const result = await subject.execute();

        expect(result).toBeNull();
    });
});
