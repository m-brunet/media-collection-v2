import type { ChangePasswordUseCase } from '../ports/driving/change-password-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../services/current-password-confirmation.service.js';

export class ChangePassword implements ChangePasswordUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: AccountLoader,
        private readonly passwords: PasswordHasher,
        private readonly confirmation: CurrentPasswordConfirmation,
    ) {}

    async execute(actor: Actor, currentPassword: string, password: string): Promise<Actor> {
        const user = await this.accounts.load(actor.id);
        const expectedVersion = user.snapshot.tokenVersion;

        await this.confirmation.confirm(user, currentPassword);
        User.validatePassword(password);

        if (password === currentPassword) {
            throw new Failure('invalid_input', 'Choose a different password.');
        }

        user.replacePassword(await this.passwords.hash(password));
        await this.users.save(user, expectedVersion);

        return user.actor;
    }
}
