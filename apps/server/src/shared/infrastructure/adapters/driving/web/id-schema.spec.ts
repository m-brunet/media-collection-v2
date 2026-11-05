import { describe, expect, it } from 'vitest';
import { idSchema } from './id-schema.js';

describe('idSchema', () => {
    it('reads an uppercase UUID as the stored lowercase id', () => {
        const id = '0F8FAD5B-D9CB-469F-A165-70867728950E';

        const result = idSchema.parse(id);

        expect(result).toBe('0f8fad5b-d9cb-469f-a165-70867728950e');
    });
    it('rejects a value that is not a UUID', () => {
        const id = 'shelf-3';

        const result = idSchema.safeParse(id);

        expect(result.success).toBe(false);
    });
});
