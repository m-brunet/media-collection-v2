import type { RecoverAdministratorUseCase } from '../ports/driving/recover-administrator-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserRepository } from '../ports/driven/user-repository.interface.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class RecoverAdministrator implements RecoverAdministratorUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly passwords: PasswordHasher,
    ) {}

    async execute(username: string, password: string): Promise<void> {
        User.validatePassword(password);
        const user = await this.users.findByUsername(User.username(username));

        if (!user || user.actor.role !== 'admin') {
            throw new Failure('not_found', 'That administrator account does not exist.');
        }

        const expectedVersion = user.snapshot.tokenVersion;

        user.replacePassword(await this.passwords.hash(password), true);
        await this.users.save(user, expectedVersion);
    }
}
