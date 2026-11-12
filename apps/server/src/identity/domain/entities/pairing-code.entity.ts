import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { User } from './user.entity.js';

export interface PairingCodeState {
    id: string;
    accountId: string;
    codeHash: string;
    tokenVersion: number;
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
}

export class PairingCode {
    static readonly lifetimeMilliseconds = 2 * 60 * 1000;
    static readonly expiredMessage = 'This QR code has expired. Show it again on the computer.';

    private state: PairingCodeState;

    constructor(state: PairingCodeState) {
        Failure.ensure(state.codeHash.length > 0, 'A pairing code hash is required.');
        Failure.ensure(
            Date.parse(state.expiresAt) > Date.parse(state.createdAt),
            'A pairing code must expire after its creation.',
        );
        this.state = { ...state };
    }

    static issue(input: { id: string; account: User; codeHash: string; now: Date }): PairingCode {
        return new PairingCode({
            id: input.id,
            accountId: input.account.actor.id,
            codeHash: input.codeHash,
            tokenVersion: input.account.snapshot.tokenVersion,
            createdAt: input.now.toISOString(),
            expiresAt: new Date(
                input.now.getTime() + PairingCode.lifetimeMilliseconds,
            ).toISOString(),
            usedAt: null,
        });
    }

    get snapshot(): PairingCodeState {
        return { ...this.state };
    }

    get accountId(): string {
        return this.state.accountId;
    }

    redeem(account: User, now: Date): void {
        if (
            this.state.usedAt !== null ||
            now.getTime() >= Date.parse(this.state.expiresAt) ||
            account.actor.id !== this.state.accountId ||
            account.snapshot.tokenVersion !== this.state.tokenVersion
        ) {
            throw new Failure('unauthorized', PairingCode.expiredMessage, 'pairing-code-expired');
        }

        const refusal = PairingCode.refusal(account);

        if (refusal) {
            throw new Failure('unauthorized', PairingCode.expiredMessage, refusal);
        }

        this.state.usedAt = now.toISOString();
    }

    private static refusal(account: User): string | null {
        if (!account.isActive) {
            return 'account-inactive';
        }

        if (account.actor.mustChangePassword) {
            return 'temporary-password';
        }

        return account.actor.role === 'admin' ? null : 'admin-only';
    }
}
