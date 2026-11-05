import { z } from 'zod';
import { idSchema } from './id-schema.js';

// A repeatable query parameter: absent, once, or several times.
const many = <T extends z.ZodType>(item: T) =>
    z.preprocess(
        (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]),
        z.array(item).max(500),
    );
const located = /^(bookcase|shelf):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Advanced book filters shared by the book and collection listings (see `BookFilterParams`).
export const bookFilterQuery = {
    category: many(z.enum(['books', 'manga', 'comics'])),
    author: many(idSchema),
    collection: many(z.union([idSchema, z.literal('none')])),
    location: many(z.union([z.literal('none'), z.string().regex(located)])),
    ownership: many(z.enum(['owned', 'not-owned'])),
    reading: many(z.enum(['read', 'unread'])),
    tag: many(idSchema),
    notTag: many(idSchema),
};

const filterSchema = z.strictObject(bookFilterQuery);

export type BookFilterParams = z.infer<typeof filterSchema>;
