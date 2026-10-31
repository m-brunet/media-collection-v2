import type { LoginUseCase } from '../ports/driving/login-use-case.interface.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { SessionTokenIssuer } from '../ports/driven/session-token-issuer.interface.js';
import type { UserReader } from '../ports/driven/user-reader.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class Login implements LoginUseCase {
    constructor(
        private readonly users: UserReader,
        private readonly passwords: PasswordHasher,
        private readonly tokens: SessionTokenIssuer,
    ) {}

    async execute(username: string, password: string): Promise<{ actor: Actor; token: string }> {
        const user = await this.users.findByUsername(username.trim().toLowerCase());

        if (!user || !(await this.passwords.matches(password, user.snapshot.passwordHash))) {
            throw new Failure('unauthorized', 'Incorrect username or password.');
        }

        return {
            actor: user.actor,
            token: await this.tokens.issue({
                userId: user.actor.id,
                version: user.snapshot.tokenVersion,
                restricted: user.actor.mustChangePassword,
            }),
        };
    }
}
