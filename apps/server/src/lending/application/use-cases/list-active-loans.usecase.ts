import type { ListActiveLoansUseCase } from '../ports/driving/list-active-loans-use-case.interface.js';
import type { ActiveLoansQuery, ReceiverLoansView } from '../loan-views.js';
import type { ActiveLoans } from '../ports/driven/active-loans.interface.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

// Which books are lent, and who has them. Everyone signed in may look, Guests included;
// completed loans are kept but not listed.
export class ListActiveLoans implements ListActiveLoansUseCase {
    constructor(private readonly loans: ActiveLoans) {}

    async execute(actor: Actor, query: ActiveLoansQuery): Promise<ReceiverLoansView[]> {
        ActorAuthorization.requireReady(actor);

        return this.loans.list(query);
    }
}
