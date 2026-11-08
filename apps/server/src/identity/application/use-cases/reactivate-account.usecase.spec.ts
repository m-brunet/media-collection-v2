import { describe, expect, it } from 'vitest';
import { AccountLifecycle } from '../testing/account-lifecycle.test-support.js';
import { ManagedAccountLoader } from '../services/managed-account-loader.service.js';
import { DeactivateAccount } from './deactivate-account.usecase.js';
import { ReactivateAccount } from './reactivate-account.usecase.js';

async function deactivated() {
    const current = await AccountLifecycle.household();

    await new DeactivateAccount(
        current.users,
        new ManagedAccountLoader(current.users),
        current.operations,
    ).execute(current.admin, 'guest');
    current.trail.entries.splice(0);

    return current;
}

describe('ReactivateAccount', () => {
    it('reactivates an account with its original role', async () => {
        const { users, operations, admin } = await deactivated();
        const subject = new ReactivateAccount(users, new ManagedAccountLoader(users), operations);

        const result = await subject.execute(admin, 'guest');

        expect(result).toMatchObject({ id: 'guest', role: 'guest', active: true });
    });
    it('records the reactivation', async () => {
        const { users, trail, operations, admin } = await deactivated();
        const subject = new ReactivateAccount(users, new ManagedAccountLoader(users), operations);

        await subject.execute(admin, 'guest');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.reactivated',
                outcome: 'successful',
                before: expect.objectContaining({ active: false }),
                after: expect.objectContaining({ active: true }),
            }),
        ]);
    });
    it('refuses to reactivate an active account', async () => {
        const { users, operations, admin } = await AccountLifecycle.household();
        const subject = new ReactivateAccount(users, new ManagedAccountLoader(users), operations);

        const result = subject.execute(admin, 'owner');

        await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'already-active' });
    });
    it('refuses a Guest reactivating an account', async () => {
        const { users, operations } = await deactivated();
        const subject = new ReactivateAccount(users, new ManagedAccountLoader(users), operations);
        const owner = (await users.findById('owner'))!.actor;

        const result = subject.execute(owner, 'guest');

        await expect(result).rejects.toMatchObject({ reason: 'admin-only' });
        expect((await users.findById('guest'))!.isActive).toBe(false);
    });
});
