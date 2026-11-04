import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ListUsersUseCase {
    execute(actor: Actor): Promise<AccountSummary[]>;
}
