import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ReactivateAccountUseCase {
    execute(actor: Actor, accountId: string): Promise<AccountSummary>;
}
