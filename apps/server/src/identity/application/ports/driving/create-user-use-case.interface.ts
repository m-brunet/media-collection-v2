import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CreateUserUseCase {
    // Only the administrator creates accounts, choosing Owner or Guest; roles never change later.
    execute(
        actor: Actor,
        input: { username: string; password: string; role: 'owner' | 'guest' },
    ): Promise<AccountSummary>;
}
