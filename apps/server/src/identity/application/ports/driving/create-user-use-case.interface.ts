import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CreateUserUseCase {
    execute(
        actor: Actor,
        input: { username: string; password: string; role: 'admin' | 'user' },
    ): Promise<Actor>;
}
