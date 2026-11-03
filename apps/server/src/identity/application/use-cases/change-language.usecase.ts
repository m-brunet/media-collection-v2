import type { ChangeLanguageUseCase } from '../ports/driving/change-language-use-case.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { Actor, InterfaceLanguage } from '../../../shared/domain/actor.helper.js';
import { AccountLoader } from '../services/account-loader.service.js';

// Saves the signed-in account's own interface language; it never changes another account.
export class ChangeLanguage implements ChangeLanguageUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: AccountLoader,
    ) {}

    async execute(actor: Actor, language: InterfaceLanguage): Promise<Actor> {
        const user = await this.accounts.load(actor.id);

        user.chooseLanguage(language);
        await this.users.save(user, user.snapshot.tokenVersion);

        return { ...user.actor, mustChangePassword: actor.mustChangePassword };
    }
}
