import { z } from 'zod';
import { bookFilterQuery } from '../../../../../shared/infrastructure/adapters/driving/web/book-filter-query.js';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

// Request shapes only; the books domain checks the actual rules and explains refusals.
const text = (max: number) => z.string().max(max).nullable();
const author = z.union([
    z.strictObject({ id: idSchema }),
    z.strictObject({ name: z.string().max(400), distinct: z.boolean().optional() }),
]);
const volume = z.number().int();
const membership = z.strictObject({
    collection: z.union([
        z.strictObject({ id: idSchema }),
        z.strictObject({ name: z.string().max(400), distinct: z.boolean().optional() }),
    ]),
    volumeFrom: volume,
    volumeTo: volume,
    enableVolumeZero: z.boolean().optional(),
});
const tag = z.union([
    z.strictObject({ id: idSchema }),
    z.strictObject({ name: z.string().max(400) }),
]);
const tags = z.array(tag).max(100);

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
    collection: membership.nullable(),
    replacePlanned: z.array(idSchema).max(100).optional(),
    shelfId: idSchema.nullable(),
    tags,
});

export const organisationSchema = z
    .strictObject({ shelfId: idSchema.nullable().optional(), tags: tags.optional() })
    .refine(
        (organisation) => organisation.shelfId !== undefined || organisation.tags !== undefined,
    );

export const newBookSchema = bookInputSchema.extend({ read: z.boolean() });

export const bookListSchema = z.strictObject({
    search: z.string().max(400).default(''),
    sort: z.enum(['title', 'added', 'published']).default('title'),
    direction: z.enum(['asc', 'desc']).default('asc'),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(48),
    ...bookFilterQuery,
});

export { idSchema };

// Find book: the ISBN as typed; the domain validates and normalises it.
export const bookLookupSchema = z.strictObject({ isbn: z.string().max(40) });

// A cover image address someone pasted; the use case checks it is a web address.
export const coverAddressSchema = z.strictObject({ address: z.string().max(2000) });
