import type { ActiveLoansQuery, ReceiverLoansView } from '../../loan-views.js';

// The books currently lent, grouped by receiver in name order.
export interface ActiveLoans {
    list(query: ActiveLoansQuery): Promise<ReceiverLoansView[]>;
}
