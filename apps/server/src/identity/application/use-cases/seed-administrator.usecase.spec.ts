import { describe, expect, it } from 'vitest';
import { clock, MemoryUsers, passwords, user } from '../testing/identity-doubles.test-support.js';
import { SeedAdministrator } from './seed-administrator.usecase.js';

describe('SeedAdministrator', () => {
    it('seeds a restricted administrator into empty storage', async () => {
        const users = new MemoryUsers();
        const subject = new SeedAdministrator(users, passwords, { next: () => 'admin' }, clock);

        await subject.execute();

        expect((await users.findById('admin'))!.snapshot).toMatchObject({
            username: 'admin',
            role: 'admin',
            passwordHash: 'hash:p@ssw0rd',
            mustChangePassword: true,
            createdAt: clock.now().toISOString(),
        });
    });
    it('preserves an existing account without seeding again', async () => {
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new SeedAdministrator(users, passwords, { next: () => 'new' }, clock);

        await subject.execute();

        expect(await users.list()).toHaveLength(1);
        expect((await users.findById('owner'))!.snapshot.passwordHash).toBe('hash:old-password');
    });
});
