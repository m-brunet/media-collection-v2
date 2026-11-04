import type { AccountSummary } from '../../../domain/entities/user.entity.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface ResetPasswordUseCase {
    // Gives another account a temporary password that must be replaced at its next sign-in.
    execute(actor: Actor, accountId: string, password: string): Promise<AccountSummary>;
}
