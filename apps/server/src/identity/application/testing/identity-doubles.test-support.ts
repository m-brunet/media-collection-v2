import type { UserState } from '../../domain/entities/user.entity.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { SessionClaims } from '../session-claims.js';
import type { SessionTokens } from '../ports/driven/session-tokens.interface.js';
import type { UserRepository } from '../ports/driven/user-repository.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class MemoryUsers implements UserRepository {
    private readonly users = new Map<string, User>();

    async list(): Promise<User[]> {
        return [...this.users.values()].map((user) => new User(user.snapshot));
    }

    async findById(id: string): Promise<User | null> {
        const user = this.users.get(id);

        return user ? new User(user.snapshot) : null;
    }

    async findByUsername(name: string): Promise<User | null> {
        return (await this.list()).find((user) => user.actor.username === name) ?? null;
    }

    async create(user: User): Promise<void> {
        if (await this.findByUsername(user.actor.username)) {
            throw new Failure('conflict', 'Duplicate username');
        }

        if (this.users.has(user.actor.id)) {
            throw new Error('The account ID already exists.');
        }

        this.users.set(user.actor.id, new User(user.snapshot));
    }

    async save(user: User, expectedVersion: number): Promise<void> {
        if (this.users.get(user.actor.id)?.snapshot.tokenVersion !== expectedVersion) {
            throw new Failure('conflict', 'Stale account');
        }

        const duplicate = await this.findByUsername(user.actor.username);

        if (duplicate && duplicate.actor.id !== user.actor.id) {
            throw new Failure('conflict', 'Duplicate username');
        }

        this.users.set(user.actor.id, new User(user.snapshot));
    }
}

export const passwords: PasswordHasher = {
    hash: async (value) => 'hash:' + value,
    matches: async (value, hash) => hash === 'hash:' + value,
};
export const tokens: SessionTokens = {
    issue: async (claims) => JSON.stringify(claims),
    verify: async (value) => {
        try {
            const claims = JSON.parse(value) as Partial<SessionClaims>;

            return typeof claims.userId === 'string' &&
                typeof claims.version === 'number' &&
                typeof claims.restricted === 'boolean'
                ? (claims as SessionClaims)
                : null;
        } catch {
            return null;
        }
    },
};
export const clock = { now: () => new Date('2026-01-01T00:00:00Z') };

export function user(input: Partial<UserState> = {}): User {
    return new User({
        id: 'owner',
        username: 'owner',
        role: 'admin',
        passwordHash: 'hash:old-password',
        mustChangePassword: false,
        language: null,
        tokenVersion: 0,
        active: true,
        createdAt: clock.now().toISOString(),
        ...input,
    });
}
