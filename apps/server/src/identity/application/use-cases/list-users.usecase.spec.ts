import { describe, expect, it } from 'vitest';
import { MemoryUsers, user } from '../testing/identity-doubles.test-support.js';
import { ListUsers } from './list-users.usecase.js';

describe('ListUsers', () => {
    it('lists safe account views for a ready administrator', async () => {
        const users = new MemoryUsers();
        const account = user();

        await users.create(account);
        const subject = new ListUsers(users);

        const result = await subject.execute(account.actor);

        expect(result).toEqual([account.actor]);
        expect(result[0]).not.toHaveProperty('passwordHash');
    });
    it('rejects a non-administrator', async () => {
        const input = { role: 'user' as const };
        const users = new MemoryUsers();
        const subject = new ListUsers(users);
        const actor = user(input).actor;

        const result = subject.execute(actor);

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
    it('rejects incomplete password setup', async () => {
        const input = { mustChangePassword: true };
        const users = new MemoryUsers();
        const subject = new ListUsers(users);
        const actor = user(input).actor;

        const result = subject.execute(actor);

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
