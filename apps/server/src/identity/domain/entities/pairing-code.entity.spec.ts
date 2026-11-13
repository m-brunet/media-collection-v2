import { describe, expect, it } from 'vitest';
import { PairingCode } from './pairing-code.entity.js';
import type { UserState } from './user.entity.js';
import { User } from './user.entity.js';

const now = new Date('2026-01-01T00:00:00.000Z');

function account(input: Partial<UserState> = {}): User {
    return new User({
        id: 'admin',
        username: 'admin',
        role: 'admin',
        passwordHash: 'hash',
        mustChangePassword: false,
        language: null,
        tokenVersion: 0,
        active: true,
        createdAt: now.toISOString(),
        ...input,
    });
}
const admin = account({ id: 'admin', username: 'admin', role: 'admin' });

function issued(): PairingCode {
    return PairingCode.issue({ id: 'code', account: admin, codeHash: 'hashed', now });
}

function later(milliseconds: number): Date {
    return new Date(now.getTime() + milliseconds);
}

describe('PairingCode', () => {
    it('is issued for the account with a 2-minute expiry and its token version', () => {
        const versioned = account({ id: 'admin', role: 'admin', tokenVersion: 4 });

        const result = PairingCode.issue({
            id: 'code',
            account: versioned,
            codeHash: 'hashed',
            now,
        });

        expect(result.snapshot).toEqual({
            id: 'code',
            accountId: 'admin',
            codeHash: 'hashed',
            tokenVersion: 4,
            createdAt: '2026-01-01T00:00:00.000Z',
            expiresAt: '2026-01-01T00:02:00.000Z',
            usedAt: null,
        });
    });
    it('requires a code hash', () => {
        const state = { ...issued().snapshot, codeHash: '' };

        const result = () => new PairingCode(state);

        expect(result).toThrow('A pairing code hash is required.');
    });
    it('is marked used when redeemed just before expiry', () => {
        const code = issued();

        code.redeem(admin, later(119_999));

        expect(code.snapshot.usedAt).toBe('2026-01-01T00:01:59.999Z');
    });
    it('refuses a redemption at the expiry', () => {
        const code = issued();

        const result = () => code.redeem(admin, later(120_000));

        expect(result).toThrow(
            expect.objectContaining({ code: 'unauthorized', reason: 'pairing-code-expired' }),
        );
    });
    it('refuses a second redemption', () => {
        const code = issued();

        code.redeem(admin, later(1000));

        const result = () => code.redeem(admin, later(2000));

        expect(result).toThrow(
            expect.objectContaining({
                reason: 'pairing-code-expired',
                message: 'This QR code has expired. Show it again on the computer.',
            }),
        );
    });
    it('refuses a code issued before the password changed', () => {
        const code = issued();
        const changed = account({ id: 'admin', role: 'admin', tokenVersion: 1 });

        const result = () => code.redeem(changed, later(1000));

        expect(result).toThrow(expect.objectContaining({ reason: 'pairing-code-expired' }));
    });
    it('refuses an inactive account', () => {
        const code = issued();
        const inactive = account({ id: 'admin', role: 'admin', active: false });

        const result = () => code.redeem(inactive, later(1000));

        expect(result).toThrow(
            expect.objectContaining({ code: 'unauthorized', reason: 'account-inactive' }),
        );
    });
    it('refuses an account with a temporary password', () => {
        const code = issued();
        const temporary = account({
            id: 'admin',
            role: 'admin',
            mustChangePassword: true,
        });

        const result = () => code.redeem(temporary, later(1000));

        expect(result).toThrow(
            expect.objectContaining({ code: 'unauthorized', reason: 'temporary-password' }),
        );
    });
    it('refuses an Owner account', () => {
        const owner = account({ id: 'admin', role: 'owner' });
        const code = PairingCode.issue({ id: 'code', account: owner, codeHash: 'hashed', now });

        const result = () => code.redeem(owner, later(1000));

        expect(result).toThrow(
            expect.objectContaining({ code: 'unauthorized', reason: 'admin-only' }),
        );
    });
    it('refuses a Guest account', () => {
        const guest = account({ id: 'admin', role: 'guest' });
        const code = PairingCode.issue({ id: 'code', account: guest, codeHash: 'hashed', now });

        const result = () => code.redeem(guest, later(1000));

        expect(result).toThrow(expect.objectContaining({ reason: 'admin-only' }));
    });
    it('keeps the code unused after a refusal', () => {
        const code = issued();
        const inactive = account({ id: 'admin', role: 'admin', active: false });

        const result = () => code.redeem(inactive, later(1000));

        expect(result).toThrow();
        expect(code.snapshot.usedAt).toBeNull();
    });
});
