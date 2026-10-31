import type { ChangeUsernameUseCase } from '../ports/driving/change-username-use-case.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../services/current-password-confirmation.service.js';

export class ChangeUsername implements ChangeUsernameUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: AccountLoader,
        private readonly confirmation: CurrentPasswordConfirmation,
    ) {}

    async execute(actor: Actor, username: string, currentPassword: string): Promise<Actor> {
        const user = await this.accounts.load(actor.id);

        await this.confirmation.confirm(user, currentPassword);
        user.rename(username);
        await this.users.save(user, user.snapshot.tokenVersion);

        return user.actor;
    }
}
