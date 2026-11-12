import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { bookFilterQuery } from './book-filter-query.js';

const schema = z.strictObject(bookFilterQuery);

describe('bookFilterQuery', () => {
    it('reads a single cover and price choice as a list', () => {
        const query = { cover: 'without', price: 'with' };

        const result = schema.parse(query);

        expect(result).toMatchObject({ cover: ['without'], price: ['with'] });
    });
    it('rejects an unknown cover choice', () => {
        const query = { cover: 'missing' };

        const result = schema.safeParse(query);

        expect(result.success).toBe(false);
    });
    it('rejects an unknown price choice', () => {
        const query = { price: ['with', 'free'] };

        const result = schema.safeParse(query);

        expect(result.success).toBe(false);
    });
});
