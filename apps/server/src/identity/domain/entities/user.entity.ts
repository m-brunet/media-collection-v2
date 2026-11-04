import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { AccountRole, Actor, InterfaceLanguage } from '../../../shared/domain/actor.helper.js';

export interface UserState extends Actor {
    passwordHash: string;
    tokenVersion: number;
    createdAt: string;
    // Deactivated accounts keep their record, data and reserved username but cannot sign in.
    active: boolean;
}

// Account information safe to show to the administrator and to record in audit entries.
export interface AccountSummary {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    active: boolean;
}

const roles: readonly AccountRole[] = ['admin', 'owner', 'guest'];

export class User {
    private state: UserState;

    constructor(state: UserState) {
        this.state = { ...state, username: User.username(state.username) };
        Failure.ensure(roles.includes(state.role), 'Invalid account role.');
        Failure.ensure(state.passwordHash.length > 0, 'A password hash is required.');
        User.validateLanguage(state.language);
    }

    get snapshot(): UserState {
        return { ...this.state };
    }

    get actor(): Actor {
        const { id, username, role, mustChangePassword, language } = this.state;

        return { id, username, role, mustChangePassword, language };
    }

    get summary(): AccountSummary {
        const { id, username, role, mustChangePassword, active } = this.state;

        return { id, username, role, mustChangePassword, active };
    }

    // The first user: never deactivated, demoted, deleted, or managed by another account.
    get isProtectedAdministrator(): boolean {
        return this.state.role === 'admin';
    }

    get isActive(): boolean {
        return this.state.active;
    }

    static username(value: string): string {
        // The spelling is kept as typed and must match exactly at sign-in. Only outer spaces go.
        const normalized = value.trim();

        Failure.ensure(
            /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(normalized),
            'Use 3–40 letters, numbers, dots, underscores or hyphens for the username.',
            'username-format',
        );

        return normalized;
    }

    static validatePassword(value: string): void {
        Failure.ensure(
            value.length >= 8 && value.length <= 128,
            'Use a password between 8 and 128 characters.',
            'password-length',
        );
    }

    private static validateLanguage(value: InterfaceLanguage | null): void {
        Failure.ensure(
            value === null || value === 'en' || value === 'fr',
            'Choose English or French as the interface language.',
        );
    }

    chooseLanguage(language: InterfaceLanguage): void {
        User.validateLanguage(language);
        this.state.language = language;
    }

    rename(username: string): void {
        this.state.username = User.username(username);
    }

    replacePassword(hash: string, temporary = false): void {
        Failure.ensure(hash.length > 0, 'A password hash is required.');
        this.state.passwordHash = hash;
        this.state.mustChangePassword = temporary;
        this.state.tokenVersion += 1;
    }

    // Ends every session immediately (token version change) and blocks sign-in.
    deactivate(): void {
        this.ensureManageable();

        if (!this.state.active) {
            throw new Failure(
                'conflict',
                'This account is already deactivated.',
                'already-inactive',
            );
        }

        this.state.active = false;
        this.state.tokenVersion += 1;
    }

    reactivate(): void {
        this.ensureManageable();

        if (this.state.active) {
            throw new Failure('conflict', 'This account is already active.', 'already-active');
        }

        this.state.active = true;
    }

    // Accounts the administrator may manage: every account except the protected administrator.
    ensureManageable(): void {
        if (this.isProtectedAdministrator) {
            throw new Failure(
                'forbidden',
                'The protected administrator account cannot be managed this way.',
                'protected-administrator',
            );
        }
    }
}
