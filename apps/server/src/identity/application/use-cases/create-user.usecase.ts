import type { CreateUserUseCase } from '../ports/driving/create-user-use-case.interface.js';
import { User } from '../../domain/entities/user.entity.js';
import type { PasswordHasher } from '../ports/driven/password-hasher.interface.js';
import type { UserWriter } from '../ports/driven/user-writer.interface.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class CreateUser implements CreateUserUseCase {
    constructor(
        private readonly users: UserWriter,
        private readonly passwords: PasswordHasher,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    async execute(
        actor: Actor,
        input: { username: string; password: string; role: 'admin' | 'user' },
    ): Promise<Actor> {
        ActorAuthorization.requireAdmin(actor);
        User.validatePassword(input.password);
        const user = new User({
            id: this.ids.next(),
            username: input.username,
            passwordHash: await this.passwords.hash(input.password),
            role: input.role,
            mustChangePassword: true,
            tokenVersion: 0,
            createdAt: this.clock.now().toISOString(),
        });

        await this.users.create(user);

        return user.actor;
    }
}
