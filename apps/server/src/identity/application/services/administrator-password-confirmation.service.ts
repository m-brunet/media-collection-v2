import type { AdministratorPasswordCheck } from '../../../maintenance/application/ports/driven/administrator-password-check.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import { AccountLoader } from './account-loader.service.js';
import { CurrentPasswordConfirmation } from './current-password-confirmation.service.js';

export class AdministratorPasswordConfirmation implements AdministratorPasswordCheck {
    private readonly accounts: AccountLoader;
    private readonly confirmation: CurrentPasswordConfirmation;

    constructor(users: UserReader, passwords: PasswordHasher) {
        this.accounts = new AccountLoader(users);
        this.confirmation = new CurrentPasswordConfirmation(passwords);
    }

    async confirm(accountId: string, password: string): Promise<void> {
        await this.confirmation.confirm(await this.accounts.load(accountId), password);
    }
}
