import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ActiveLoansQuery, ReceiverLoansView } from '../../loan-views.js';

export interface ListActiveLoansUseCase {
    // The books currently lent, grouped by receiver.
    execute(actor: Actor, query: ActiveLoansQuery): Promise<ReceiverLoansView[]>;
}
