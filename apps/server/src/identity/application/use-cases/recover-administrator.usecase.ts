import type { RecoverAdministratorUseCase } from '../ports/driving/recover-administrator-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserRepository } from '../ports/driven/user-repository.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountAudit } from '../account-audit.js';

export class RecoverAdministrator implements RecoverAdministratorUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly passwords: PasswordHasher,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(password: string): Promise<{ username: string }> {
        return this.operations.run(
            {
                category: AccountAudit.recovered,
                actorId: null,
                subjectType: AccountAudit.subject,
                subjectId: null,
            },
            async (context) => {
                const user = (await this.users.list()).find(
                    (candidate) => candidate.isProtectedAdministrator,
                );

                if (!user) {
                    throw new Failure(
                        'not_found',
                        'There is no administrator account yet.',
                        'administrator-missing',
                    );
                }

                context.subjectId = user.actor.id;
                User.validatePassword(password);
                const before = user.summary;
                const expectedVersion = user.snapshot.tokenVersion;

                user.replacePassword(await this.passwords.hash(password), true);
                await this.users.save(user, expectedVersion);

                return {
                    result: { username: user.actor.username },
                    before: { ...before },
                    after: { ...user.summary },
                };
            },
        );
    }
}
