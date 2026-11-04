import type { CreateUserUseCase } from '../ports/driving/create-user-use-case.interface.js';
import type { AccountSummary } from '../../domain/entities/user.entity.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountAudit } from '../account-audit.js';

export class CreateUser implements CreateUserUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly passwords: PasswordHasher,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(
        actor: Actor,
        input: { username: string; password: string; role: 'owner' | 'guest' },
    ): Promise<AccountSummary> {
        return this.operations.run(
            {
                category: AccountAudit.created,
                actorId: actor.id,
                subjectType: AccountAudit.subject,
                subjectId: null,
            },
            async (context) => {
                ActorAuthorization.requireAdmin(actor);
                Failure.ensure(
                    input.role === 'owner' || input.role === 'guest',
                    'Choose Owner or Guest.',
                    'role-required',
                );
                User.validatePassword(input.password);
                const user = new User({
                    id: this.ids.next(),
                    username: input.username,
                    passwordHash: await this.passwords.hash(input.password),
                    role: input.role,
                    mustChangePassword: true,
                    language: null,
                    tokenVersion: 0,
                    createdAt: this.clock.now().toISOString(),
                    active: true,
                });

                context.subjectId = user.actor.id;
                await this.users.create(user);

                return { result: user.summary, before: null, after: { ...user.summary } };
            },
        );
    }
}
