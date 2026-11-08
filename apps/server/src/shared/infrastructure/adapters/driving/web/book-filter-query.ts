import { z } from 'zod';
import { idSchema } from './id-schema.js';

// A repeatable query parameter: absent, once, or several times.
class RepeatedParameter {
    static of<T extends z.ZodType>(item: T) {
        return z.preprocess(
            (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
            z.array(item).max(500),
        );
    }
}
const located = /^(bookcase|shelf):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Advanced book filters shared by the book and collection listings (see `BookFilterParams`).
export const bookFilterQuery = {
    category: RepeatedParameter.of(z.enum(['books', 'manga', 'comics'])),
    author: RepeatedParameter.of(idSchema),
    collection: RepeatedParameter.of(z.union([idSchema, z.literal('none')])),
    location: RepeatedParameter.of(z.union([z.literal('none'), z.string().regex(located)])),
    ownership: RepeatedParameter.of(z.enum(['owned', 'not-owned'])),
    reading: RepeatedParameter.of(z.enum(['read', 'unread'])),
    tag: RepeatedParameter.of(idSchema),
    notTag: RepeatedParameter.of(idSchema),
};

const filterSchema = z.strictObject(bookFilterQuery);

export type BookFilterParams = z.infer<typeof filterSchema>;
