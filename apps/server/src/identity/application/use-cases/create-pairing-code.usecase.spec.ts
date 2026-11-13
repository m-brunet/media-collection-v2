import { describe, expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import type { UserState } from '../../domain/entities/user.entity.js';
import { AccountLoader } from '../services/account-loader.service.js';
import {
    clock,
    IdentityDoubles,
    MemoryPairingCodes,
    MemoryUsers,
    SequentialPairingSecrets,
} from '../testing/identity-doubles.test-support.js';
import { CreatePairingCode } from './create-pairing-code.usecase.js';

const home = 'http://192.168.1.20:3000';

async function setup(account: Partial<UserState> = {}, accepted = [home]) {
    const users = new MemoryUsers();
    const user = IdentityDoubles.user({
        id: 'admin',
        username: 'admin',
        role: 'admin',
        ...account,
    });
    const codes = new MemoryPairingCodes();
    const trail = new MemoryAuditTrail();
    let next = 0;

    await users.create(user);

    return {
        actor: user.actor,
        codes,
        trail,
        subject: new CreatePairingCode(
            new AccountLoader(users),
            { accepts: async (address) => accepted.includes(address) },
            new SequentialPairingSecrets(),
            codes,
            { next: () => '00000000-0000-4000-8000-00000000000' + ++next },
            clock,
            AuditDoubles.auditedOperation(trail),
        ),
    };
}

describe('CreatePairingCode', () => {
    it('gives the Leaf link of the address with the code after the hash sign', async () => {
        const { subject, actor } = await setup();

        const result = await subject.execute(actor, home);

        expect(result).toEqual({
            link: 'http://192.168.1.20:3000/leaf/#pair=secret-1',
            expiresAt: '2026-01-01T00:02:00.000Z',
        });
    });
    it('stores only the hash of the code for the account', async () => {
        const { subject, actor, codes } = await setup();

        await subject.execute(actor, home);

        expect(codes.all.map((code) => code.snapshot)).toEqual([
            expect.objectContaining({
                accountId: 'admin',
                codeHash: 'hashed:secret-1',
                usedAt: null,
            }),
        ]);
    });
    it('replaces the previous code of the account', async () => {
        const { subject, actor, codes } = await setup();

        await subject.execute(actor, home);

        await subject.execute(actor, home);

        expect(codes.all.map((code) => code.snapshot.codeHash)).toEqual(['hashed:secret-2']);
    });
    it('refuses an address that cannot sign a phone in', async () => {
        const { subject, actor, codes } = await setup();

        const result = subject.execute(actor, 'http://82.66.118.204:3000');

        await expect(result).rejects.toMatchObject({
            code: 'invalid_input',
            reason: 'pairing-address-ineligible',
        });
        expect(codes.all).toEqual([]);
    });
    it('refuses an Owner', async () => {
        const { subject, actor } = await setup({ role: 'owner' });

        const result = subject.execute(actor, home);

        await expect(result).rejects.toMatchObject({ code: 'forbidden', reason: 'admin-only' });
    });
    it('refuses a Guest', async () => {
        const { subject, actor } = await setup({ role: 'guest' });

        const result = subject.execute(actor, home);

        await expect(result).rejects.toMatchObject({ code: 'forbidden', reason: 'admin-only' });
    });
    it('refuses an Admin with a temporary password', async () => {
        const { subject, actor } = await setup({ mustChangePassword: true });

        const result = subject.execute(actor, home);

        await expect(result).rejects.toMatchObject({
            code: 'forbidden',
            reason: 'temporary-password',
        });
    });
    it('records the creation without the code', async () => {
        const { subject, actor, trail } = await setup();

        await subject.execute(actor, home);

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'authentication.pairing-code-created',
                outcome: 'successful',
                actorId: 'admin',
                subjectId: 'admin',
                after: { address: home, expiresAt: '2026-01-01T00:02:00.000Z' },
            }),
        ]);
        expect(JSON.stringify(trail.entries)).not.toContain('secret-1');
    });
});
