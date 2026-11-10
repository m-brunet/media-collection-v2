import type { LoginUseCase } from '../ports/driving/login-use-case.interface.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { SessionTokenIssuer } from '../ports/driven/session-token-issuer.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { AuditedOperation } from '../../../shared/application/services/audited-operation.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { AccountAudit } from '../account-audit.js';

// A deactivated account gets the same answer as wrong credentials, so sign-in does not reveal
// account states.
export class Login implements LoginUseCase {
    constructor(
        private readonly users: UserReader,
        private readonly passwords: PasswordHasher,
        private readonly tokens: SessionTokenIssuer,
        private readonly operations: AuditedOperation,
    ) {}

    async execute(username: string, password: string): Promise<{ actor: Actor; token: string }> {
        return this.operations.run(
            {
                category: AccountAudit.signedIn,
                actorId: null,
                subjectType: AccountAudit.subject,
                subjectId: null,
            },
            async (context) => {
                const user = await this.users.findByUsername(username.trim());

                if (user) {
                    context.actorId = user.actor.id;
                    context.subjectId = user.actor.id;
                }

                if (
                    !user ||
                    !user.isActive ||
                    !(await this.passwords.matches(password, user.snapshot.passwordHash))
                ) {
                    throw new Failure(
                        'unauthorized',
                        'Incorrect username or password.',
                        'credentials-incorrect',
                    );
                }

                return {
                    result: {
                        actor: user.actor,
                        token: await this.tokens.issue({
                            userId: user.actor.id,
                            version: user.snapshot.tokenVersion,
                            restricted: user.actor.mustChangePassword,
                        }),
                    },
                    before: null,
                    after: null,
                };
            },
        );
    }
}
