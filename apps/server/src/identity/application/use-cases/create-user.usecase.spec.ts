import { describe, expect, it } from 'vitest';
import { clock, MemoryUsers, passwords, user } from '../testing/identity-doubles.test-support.js';
import { CreateUser } from './create-user.usecase.js';

describe('CreateUser', () => {
    it('creates a normalized account requiring password replacement', async () => {
        const users = new MemoryUsers();
        const subject = new CreateUser(users, passwords, { next: () => 'member' }, clock);
        const actor = user().actor;
        const input = {
            username: ' Member ',
            password: 'temporary-password',
            role: 'user' as const,
        };

        const result = await subject.execute(actor, input);

        expect(result).toMatchObject({
            id: 'member',
            username: 'member',
            role: 'user',
            mustChangePassword: true,
        });
        expect((await users.findById('member'))!.snapshot.passwordHash).toBe(
            'hash:temporary-password',
        );
    });
    it('rejects a short password', async () => {
        const password = 'short';
        const users = new MemoryUsers();
        const subject = new CreateUser(users, passwords, { next: () => 'member' }, clock);
        const input = { username: 'member', password, role: 'user' as const };

        const result = subject.execute(user().actor, input);

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
        expect(await users.list()).toEqual([]);
    });
    it('rejects an overlong password', async () => {
        const password = 'x'.repeat(129);
        const users = new MemoryUsers();
        const subject = new CreateUser(users, passwords, { next: () => 'member' }, clock);
        const input = { username: 'member', password, role: 'user' as const };

        const result = subject.execute(user().actor, input);

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
        expect(await users.list()).toEqual([]);
    });
    it('rejects a duplicate username', async () => {
        const users = new MemoryUsers();

        await users.create(user());
        const subject = new CreateUser(users, passwords, { next: () => 'member' }, clock);
        const input = { username: 'owner', password: 'temporary-password', role: 'user' as const };

        const result = subject.execute(user().actor, input);

        await expect(result).rejects.toMatchObject({ code: 'conflict' });
    });
    it('rejects a non-administrator', async () => {
        const input = { role: 'user' as const };
        const users = new MemoryUsers();
        const subject = new CreateUser(users, passwords, { next: () => 'member' }, clock);
        const actor = user(input).actor;

        const result = subject.execute(actor, {
            username: 'member',
            password: 'temporary-password',
            role: 'user',
        });

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
    it('rejects incomplete password setup', async () => {
        const input = { mustChangePassword: true };
        const users = new MemoryUsers();
        const subject = new CreateUser(users, passwords, { next: () => 'member' }, clock);
        const actor = user(input).actor;

        const result = subject.execute(actor, {
            username: 'member',
            password: 'temporary-password',
            role: 'user',
        });

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
