import { randomUUID } from 'node:crypto';
import { User } from '../../../apps/server/src/identity/domain/entities/user.entity.js';
import type { Actor } from '../../../apps/server/src/shared/domain/actor.helper.js';
import type { ApiFixture } from '../setup/fixture.js';
import type { TestAppContext } from '../setup/test-app-context.js';

export class UserFixture implements ApiFixture {
    readonly id: string;
    readonly username: string;
    readonly password: string;
    readonly role: Actor['role'];
    readonly mustChangePassword: boolean;
    readonly active: boolean;

    constructor(
        input: {
            id?: string;
            username?: string;
            password?: string;
            role?: Actor['role'];
            mustChangePassword?: boolean;
            active?: boolean;
        } = {},
    ) {
        this.id = input.id ?? randomUUID();
        this.username = input.username ?? 'u-' + this.id;
        this.password = input.password ?? 'fixture-password';
        this.role = input.role ?? 'owner';
        this.mustChangePassword = input.mustChangePassword ?? false;
        this.active = input.active ?? true;
    }

    async save(context: Pick<TestAppContext, 'users' | 'passwords'>): Promise<void> {
        await context.users.create(
            new User({
                id: this.id,
                username: this.username,
                role: this.role,
                passwordHash: await context.passwords.hash(this.password),
                mustChangePassword: this.mustChangePassword,
                language: null,
                tokenVersion: 0,
                createdAt: '2026-01-01T00:00:00.000Z',
                active: this.active,
            }),
        );
    }

    getId(): string {
        return this.id;
    }
}
