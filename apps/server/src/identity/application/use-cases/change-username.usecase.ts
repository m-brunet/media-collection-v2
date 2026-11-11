import type { ChangeUsernameUseCase } from '../ports/driving/change-username-use-case.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { AccountAudit } from '../account-audit.js';
import { AccountLoader } from '../services/account-loader.service.js';
import { CurrentPasswordConfirmation } from '../services/current-password-confirmation.service.js';

export class ChangeUsername implements ChangeUsernameUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: AccountLoader,
        private readonly confirmation: CurrentPasswordConfirmation,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, username: string, currentPassword: string): Promise<Actor> {
        return this.operations.run(
            {
                category: AccountAudit.renamed,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: actor.id,
            },
            async () => {
                const user = await this.accounts.load(actor.id);
                const before = { username: user.actor.username };

                await this.confirmation.confirm(user, currentPassword);
                user.rename(username);
                await this.users.save(user, user.snapshot.tokenVersion);

                return {
                    result: user.actor,
                    before,
                    after: { username: user.actor.username },
                };
            },
        );
    }
}
