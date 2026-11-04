import type { CompleteSetupUseCase } from '../ports/driving/complete-setup-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { SessionTokenIssuer } from '../ports/driven/session-token-issuer.interface.js';
import type { UserRepository } from '../ports/driven/user-repository.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountAudit } from '../account-audit.js';

// First launch: the person installing the library creates the protected administrator with a
// password of their choice. Possible only while no account exists; never a public sign-up.
export class CompleteSetup implements CompleteSetupUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly passwords: PasswordHasher,
        private readonly tokens: SessionTokenIssuer,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(input: {
        username: string;
        password: string;
    }): Promise<{ actor: Actor; token: string }> {
        const id = this.ids.next();
        const user = await this.operations.run(
            {
                category: AccountAudit.setup,
                actorId: null,
                subjectType: AccountAudit.subject,
                subjectId: id,
            },
            async (context) => {
                if ((await this.users.list()).length > 0) {
                    throw new Failure(
                        'conflict',
                        'This library already has its administrator.',
                        'setup-completed',
                    );
                }

                User.validatePassword(input.password);
                const administrator = new User({
                    id,
                    username: input.username,
                    passwordHash: await this.passwords.hash(input.password),
                    role: 'admin',
                    mustChangePassword: false,
                    language: null,
                    tokenVersion: 0,
                    createdAt: this.clock.now().toISOString(),
                    active: true,
                });

                await this.users.create(administrator);
                context.actorId = id;

                return {
                    result: administrator,
                    before: null,
                    after: { ...administrator.summary },
                };
            },
        );

        return {
            actor: user.actor,
            token: await this.tokens.issue({ userId: id, version: 0, restricted: false }),
        };
    }
}
