import type { ChangePasswordUseCase } from '../ports/driving/change-password-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountAudit } from '../account-audit.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../services/current-password-confirmation.service.js';

// The audit records that the password changed, never the password or its hash.
export class ChangePassword implements ChangePasswordUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: AccountLoader,
        private readonly passwords: PasswordHasher,
        private readonly confirmation: CurrentPasswordConfirmation,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, currentPassword: string, password: string): Promise<Actor> {
        return this.operations.run(
            {
                category: AccountAudit.passwordChanged,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: actor.id,
            },
            async () => {
                const user = await this.accounts.load(actor.id);
                const expectedVersion = user.snapshot.tokenVersion;
                const before = { temporaryPassword: user.actor.mustChangePassword };

                await this.confirmation.confirm(user, currentPassword);
                User.validatePassword(password);

                if (password === currentPassword) {
                    throw new Failure(
                        'invalid_input',
                        'Choose a different password.',
                        'password-unchanged',
                    );
                }

                user.replacePassword(await this.passwords.hash(password));
                await this.users.save(user, expectedVersion);

                return {
                    result: user.actor,
                    before,
                    after: { temporaryPassword: user.actor.mustChangePassword },
                };
            },
        );
    }
}
