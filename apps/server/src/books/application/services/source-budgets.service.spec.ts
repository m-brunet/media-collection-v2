import { describe, expect, it } from 'vitest';
import { ManualClock } from '../testing/book-doubles.test-support.js';
import { SourceBudgets } from './source-budgets.service.js';

describe('SourceBudgets', () => {
    it('gives every user of a source the same budget', () => {
        const budgets = new SourceBudgets(new ManualClock());
        const limit = { requests: 1, seconds: 60 };

        budgets.of({ name: 'bnf', limit }).take();

        expect(budgets.of({ name: 'bnf', limit }).take()).toBe(false);
        expect(budgets.of({ name: 'openlibrary', limit }).take()).toBe(true);
    });
});
