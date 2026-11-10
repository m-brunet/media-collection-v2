import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CreateUserUseCase {
    execute(
        actor: Actor,
        input: { username: string; password: string; role: 'owner' | 'guest' },
    ): Promise<AccountSummary>;
}
