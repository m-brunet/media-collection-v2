import { describe, expect, it } from 'vitest';
import { AccountLifecycle } from '../testing/account-lifecycle.test-support.js';
import { passwords } from '../testing/identity-doubles.test-support.js';
import { ManagedAccountLoader } from '../services/managed-account-loader.service.js';
import { ResetPassword } from './reset-password.usecase.js';

describe('ResetPassword', () => {
    it('sets a temporary password that must be replaced at the next sign-in', async () => {
        const { users, operations, admin } = await AccountLifecycle.household();
        const subject = new ResetPassword(
            users,
            new ManagedAccountLoader(users),
            passwords,
            operations,
        );

        const result = await subject.execute(admin, 'owner', 'temporary-password');

        expect(result.mustChangePassword).toBe(true);
        expect((await users.findById('owner'))!.snapshot).toMatchObject({
            passwordHash: 'hash:temporary-password',
            tokenVersion: 1,
        });
    });
    it('records the reset without any password', async () => {
        const { users, trail, operations, admin } = await AccountLifecycle.household();
        const subject = new ResetPassword(
            users,
            new ManagedAccountLoader(users),
            passwords,
            operations,
        );

        await subject.execute(admin, 'guest', 'temporary-password');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.password-reset',
                outcome: 'successful',
                subjectId: 'guest',
                after: expect.objectContaining({ mustChangePassword: true }),
            }),
        ]);
        expect(JSON.stringify(trail.entries)).not.toContain('temporary-password');
    });
    it('refuses to reset the protected administrator', async () => {
        const { users, operations, admin } = await AccountLifecycle.household();
        const subject = new ResetPassword(
            users,
            new ManagedAccountLoader(users),
            passwords,
            operations,
        );

        const result = subject.execute(admin, 'admin', 'temporary-password');

        await expect(result).rejects.toMatchObject({ reason: 'protected-administrator' });
    });
    it('rejects a short temporary password', async () => {
        const { users, operations, admin } = await AccountLifecycle.household();
        const subject = new ResetPassword(
            users,
            new ManagedAccountLoader(users),
            passwords,
            operations,
        );

        const result = subject.execute(admin, 'owner', 'short');

        await expect(result).rejects.toMatchObject({ reason: 'password-length' });
        expect((await users.findById('owner'))!.snapshot.tokenVersion).toBe(0);
    });
    it('refuses an Owner resetting another password', async () => {
        const { users, operations } = await AccountLifecycle.household();
        const subject = new ResetPassword(
            users,
            new ManagedAccountLoader(users),
            passwords,
            operations,
        );
        const owner = (await users.findById('owner'))!.actor;

        const result = subject.execute(owner, 'guest', 'temporary-password');

        await expect(result).rejects.toMatchObject({ reason: 'admin-only' });
    });
});
