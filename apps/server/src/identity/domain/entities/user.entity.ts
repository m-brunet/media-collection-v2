import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';

export interface UserState extends Actor {
    passwordHash: string;
    tokenVersion: number;
    createdAt: string;
}

export class User {
    private state: UserState;

    constructor(state: UserState) {
        this.state = { ...state, username: User.username(state.username) };
        Failure.ensure(state.role === 'admin' || state.role === 'user', 'Invalid account role.');
        Failure.ensure(state.passwordHash.length > 0, 'A password hash is required.');
    }

    get snapshot(): UserState {
        return { ...this.state };
    }

    get actor(): Actor {
        const { id, username, role, mustChangePassword } = this.state;

        return { id, username, role, mustChangePassword };
    }

    static username(value: string): string {
        const normalized = value.trim().toLowerCase();

        Failure.ensure(
            /^[a-z0-9][a-z0-9._-]{2,39}$/.test(normalized),
            'Use 3–40 letters, numbers, dots, underscores or hyphens for the username.',
        );

        return normalized;
    }

    static validatePassword(value: string): void {
        Failure.ensure(
            value.length >= 8 && value.length <= 128,
            'Use a password between 8 and 128 characters.',
        );
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
}
