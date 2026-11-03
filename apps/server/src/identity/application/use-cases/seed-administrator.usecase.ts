import type { SeedAdministratorUseCase } from '../ports/driving/seed-administrator-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserRepository } from '../ports/driven/user-repository.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';

export class SeedAdministrator implements SeedAdministratorUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly passwords: PasswordHasher,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<void> {
        if ((await this.users.list()).length > 0) {
            return;
        }

        await this.users.create(
            new User({
                id: this.ids.next(),
                username: 'admin',
                role: 'admin',
                passwordHash: await this.passwords.hash('p@ssw0rd'),
                mustChangePassword: true,
                language: null,
                tokenVersion: 0,
                createdAt: this.clock.now().toISOString(),
            }),
        );
    }
}
