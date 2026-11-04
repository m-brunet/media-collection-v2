import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface DeactivateAccountUseCase {
    execute(actor: Actor, accountId: string): Promise<AccountSummary>;
}
