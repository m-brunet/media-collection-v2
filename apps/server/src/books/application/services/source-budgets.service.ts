import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import { SourceBudget } from './source-budget.service.js';

export type BudgetedSource = { name: string; limit: { requests: number; seconds: number } };

export class SourceBudgets {
    private readonly budgets = new Map<string, SourceBudget>();

    constructor(private readonly clock: Clock) {}

    of(source: BudgetedSource): SourceBudget {
        const known = this.budgets.get(source.name);

        if (known) {
            return known;
        }

        const budget = new SourceBudget(source.limit, this.clock);

        this.budgets.set(source.name, budget);

        return budget;
    }
}
