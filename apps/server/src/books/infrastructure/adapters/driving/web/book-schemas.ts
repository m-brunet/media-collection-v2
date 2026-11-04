import { z } from 'zod';

// Request shapes only; the books domain checks the actual rules and explains refusals.
const text = (max: number) => z.string().max(max).nullable();
const author = z.union([
    z.strictObject({ id: z.uuid() }),
    z.strictObject({ name: z.string().max(400), distinct: z.boolean().optional() }),
]);

export const bookInputSchema = z.strictObject({
    title: z.string().max(1000),
    isbn: text(40),
    noIsbn: z.boolean(),
    authors: z.array(author).max(30),
    category: z.enum(['books', 'manga', 'comics']),
    ownership: z.enum(['owned', 'not-owned']),
    publisher: text(1000),
    publicationYear: z.number().int().nullable(),
    publicationMonth: z.number().int().nullable(),
    summary: text(20000),
    pageCount: z.number().int().nullable(),
    price: text(40),
    confirmDistinct: z.boolean().optional(),
});

export const newBookSchema = bookInputSchema.extend({ read: z.boolean() });

export const bookListSchema = z.strictObject({
    search: z.string().max(400).default(''),
    sort: z.enum(['title', 'added', 'published']).default('title'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(48),
});

export const idSchema = z.uuid();
