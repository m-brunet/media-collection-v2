import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ResetPasswordUseCase {
    execute(actor: Actor, accountId: string, password: string): Promise<AccountSummary>;
}
