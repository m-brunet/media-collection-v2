import type { ActiveLoansQuery, ReceiverLoansView } from '../../loan-views.js';

export interface ActiveLoans {
    list(query: ActiveLoansQuery): Promise<ReceiverLoansView[]>;
}
