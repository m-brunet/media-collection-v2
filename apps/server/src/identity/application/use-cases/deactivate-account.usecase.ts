import type { DeactivateAccountUseCase } from '../ports/driving/deactivate-account-use-case.interface.js';
import type { AccountSummary } from '../../domain/entities/user.entity.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { AccountAudit } from '../account-audit.js';
import { ManagedAccountLoader } from '../services/managed-account-loader.service.js';

// "Deleting" an account deactivates it: its record, private data and username are kept.
export class DeactivateAccount implements DeactivateAccountUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: ManagedAccountLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, accountId: string): Promise<AccountSummary> {
        return this.operations.run(
            {
                category: AccountAudit.deactivated,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: accountId,
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const user = await this.accounts.load(accountId);
                const before = user.summary;
                const expectedVersion = user.snapshot.tokenVersion;

                user.deactivate();
                await this.users.save(user, expectedVersion);

                return { result: user.summary, before: { ...before }, after: { ...user.summary } };
            },
        );
    }
}
