import { describe, expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { PairingCode } from '../../domain/entities/pairing-code.entity.js';
import type { UserState } from '../../domain/entities/user.entity.js';
import {
    IdentityDoubles,
    MemoryPairingCodes,
    MemoryUsers,
    SequentialPairingSecrets,
    tokens,
} from '../testing/identity-doubles.test-support.js';
import { RedeemPairingCode } from './redeem-pairing-code.usecase.js';

const issuedAt = new Date('2026-01-01T00:00:00.000Z');

async function setup(
    options: { account?: Partial<UserState>; elapsed?: number; current?: Partial<UserState> } = {},
) {
    const users = new MemoryUsers();
    const codes = new MemoryPairingCodes();
    const trail = new MemoryAuditTrail();
    const account = IdentityDoubles.user({
        id: 'admin',
        username: 'admin',
        role: 'admin',
        ...options.account,
    });

    await users.create(
        options.current
            ? IdentityDoubles.user({ ...account.snapshot, ...options.current })
            : account,
    );
    await codes.replace(
        PairingCode.issue({ id: 'code', account, codeHash: 'hashed:secret', now: issuedAt }),
    );

    return {
        codes,
        trail,
        subject: new RedeemPairingCode(
            codes,
            new SequentialPairingSecrets(),
            users,
            tokens,
            { now: () => new Date(issuedAt.getTime() + (options.elapsed ?? 1000)) },
            AuditDoubles.auditedOperation(trail),
        ),
    };
}

describe('RedeemPairingCode', () => {
    it('signs the Admin in with unrestricted session claims', async () => {
        const { subject } = await setup({ account: { tokenVersion: 3 } });

        const result = await subject.execute('secret');

        expect(result.actor).toMatchObject({ id: 'admin', role: 'admin' });
        expect(JSON.parse(result.token)).toEqual({
            userId: 'admin',
            version: 3,
            restricted: false,
        });
    });
    it('marks the code used', async () => {
        const { subject, codes } = await setup();

        await subject.execute('secret');

        expect(codes.all[0]?.snapshot.usedAt).toBe('2026-01-01T00:00:01.000Z');
    });
    it('refuses a code used before', async () => {
        const { subject } = await setup();

        await subject.execute('secret');

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({
            code: 'unauthorized',
            reason: 'pairing-code-expired',
        });
    });
    it('refuses an expired code', async () => {
        const { subject } = await setup({ elapsed: 120_000 });

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({ reason: 'pairing-code-expired' });
    });
    it('refuses an unknown code', async () => {
        const { subject } = await setup();

        const result = subject.execute('another-secret');

        await expect(result).rejects.toMatchObject({ reason: 'pairing-code-expired' });
    });
    it('refuses an account deactivated since the code was shown', async () => {
        const { subject } = await setup({ current: { active: false } });

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({ reason: 'account-inactive' });
    });
    it('refuses an account that must replace a temporary password', async () => {
        const { subject } = await setup({ current: { mustChangePassword: true } });

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
    });
    it('refuses an Owner account', async () => {
        const { subject } = await setup({ account: { role: 'owner' } });

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({ reason: 'admin-only' });
    });
    it('refuses a Guest account', async () => {
        const { subject } = await setup({ account: { role: 'guest' } });

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({ reason: 'admin-only' });
    });
    it('refuses a code shown before a password change', async () => {
        const { subject } = await setup({ current: { tokenVersion: 1 } });

        const result = subject.execute('secret');

        await expect(result).rejects.toMatchObject({ reason: 'pairing-code-expired' });
    });
    it('records the sign-in for the account without the code', async () => {
        const { subject, trail } = await setup();

        await subject.execute('secret');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'authentication.signed-in-with-pairing-code',
                outcome: 'successful',
                actorId: 'admin',
                subjectId: 'admin',
            }),
        ]);
        expect(JSON.stringify(trail.entries)).not.toContain('secret');
    });
    it('records a refused code as a failed sign-in', async () => {
        const { subject, trail } = await setup({ elapsed: 120_000 });

        await subject.execute('secret').catch(() => undefined);

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'authentication.signed-in-with-pairing-code',
                outcome: 'failed',
                actorId: 'admin',
                failure: 'unauthorized:pairing-code-expired',
            }),
        ]);
    });
});
