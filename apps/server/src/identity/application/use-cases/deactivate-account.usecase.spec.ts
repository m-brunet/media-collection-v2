import { describe, expect, it } from 'vitest';
import { household } from '../testing/account-lifecycle.test-support.js';
import { ManagedAccountLoader } from '../services/managed-account-loader.service.js';
import { DeactivateAccount } from './deactivate-account.usecase.js';

describe('DeactivateAccount', () => {
    it('deactivates an Owner and keeps the account record', async () => {
        const { users, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        const result = await subject.execute(admin, 'owner');

        expect(result).toMatchObject({ id: 'owner', username: 'camille', active: false });
        expect((await users.findById('owner'))!.isActive).toBe(false);
    });
    it('ends the existing sessions of the deactivated account', async () => {
        const { users, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        await subject.execute(admin, 'guest');

        expect((await users.findById('guest'))!.snapshot.tokenVersion).toBe(1);
    });
    it('keeps the username reserved', async () => {
        const { users, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        await subject.execute(admin, 'guest');

        expect((await users.findByUsername('morgan'))!.actor.id).toBe('guest');
    });
    it('records the deactivation with before and after states', async () => {
        const { users, trail, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        await subject.execute(admin, 'owner');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.deactivated',
                outcome: 'successful',
                actorId: 'admin',
                subjectId: 'owner',
                before: expect.objectContaining({ active: true }),
                after: expect.objectContaining({ active: false }),
            }),
        ]);
    });
    it('refuses to deactivate the protected administrator', async () => {
        const { users, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        const result = subject.execute(admin, 'admin');

        await expect(result).rejects.toMatchObject({ reason: 'protected-administrator' });
        expect((await users.findById('admin'))!.isActive).toBe(true);
    });
    it('refuses an Owner deactivating another account', async () => {
        const { users, operations } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);
        const owner = (await users.findById('owner'))!.actor;

        const result = subject.execute(owner, 'guest');

        await expect(result).rejects.toMatchObject({ code: 'forbidden', reason: 'admin-only' });
        expect((await users.findById('guest'))!.isActive).toBe(true);
    });
    it('reports an unknown account', async () => {
        const { users, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        const result = subject.execute(admin, 'missing');

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'account-missing',
        });
    });
    it('records a refused deactivation as Failed', async () => {
        const { users, trail, operations, admin } = await household();
        const subject = new DeactivateAccount(users, new ManagedAccountLoader(users), operations);

        await subject.execute(admin, 'admin').catch(() => undefined);

        expect(trail.entries).toEqual([
            expect.objectContaining({
                outcome: 'failed',
                subjectId: 'admin',
                failure: 'forbidden:protected-administrator',
            }),
        ]);
    });
});
