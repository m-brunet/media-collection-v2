import type { ReactivateAccountUseCase } from '../ports/driving/reactivate-account-use-case.interface.js';
import type { AccountSummary } from '../../domain/entities/user.entity.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { AccountAudit } from '../account-audit.js';
import { ManagedAccountLoader } from '../services/managed-account-loader.service.js';

export class ReactivateAccount implements ReactivateAccountUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly accounts: ManagedAccountLoader,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(actor: Actor, accountId: string): Promise<AccountSummary> {
        return this.operations.run(
            {
                category: AccountAudit.reactivated,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: accountId,
            },
            async () => {
                ActorAuthorization.requireAdmin(actor);
                const user = await this.accounts.load(accountId);
                const before = user.summary;
                const expectedVersion = user.snapshot.tokenVersion;

                user.reactivate();
                await this.users.save(user, expectedVersion);

                return { result: user.summary, before: { ...before }, after: { ...user.summary } };
            },
        );
    }
}
