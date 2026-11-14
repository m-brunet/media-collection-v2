import { z } from 'zod';
import { bookFilterQuery } from '../../../../../shared/infrastructure/adapters/driving/web/book-filter-query.js';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

class BookFields {
    static text(max: number) {
        return z.string().max(max).nullable();
    }
}
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
    isbn: BookFields.text(40),
    noIsbn: z.boolean(),
    authors: z.array(author).max(30),
    category: z.enum(['books', 'manga', 'comics']),
    ownership: z.enum(['owned', 'not-owned']),
    publisher: BookFields.text(1000),
    publicationYear: z.number().int().nullable(),
    publicationMonth: z.number().int().nullable(),
    summary: BookFields.text(20000),
    pageCount: z.number().int().nullable(),
    price: BookFields.text(40),
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

export const bookBatchSchema = z.strictObject({
    collectionId: idSchema,
    bookIds: z.array(idSchema).min(1).max(1000),
    preview: z.boolean(),
    changes: z
        .strictObject({
            ownership: z.enum(['owned', 'not-owned']).optional(),
            publisher: BookFields.text(1000).optional(),
            price: BookFields.text(40).optional(),
            shelfId: idSchema.nullable().optional(),
            tags: z
                .strictObject({
                    add: z.array(idSchema).max(100),
                    remove: z.array(idSchema).max(100),
                })
                .refine((tags) => !tags.add.some((id) => tags.remove.includes(id)))
                .optional(),
            authors: z.array(author).min(1).max(30).optional(),
            read: z.boolean().optional(),
            generatedTitles: z.literal(true).optional(),
            onlyIfEmpty: z
                .array(z.enum(['publisher', 'price', 'shelfId']))
                .max(3)
                .optional(),
        })
        .refine((changes) =>
            (changes.onlyIfEmpty ?? []).every((field) => Boolean(changes[field]?.trim())),
        ),
});

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

export const bookLookupSchema = z.strictObject({ isbn: z.string().max(40) });

export const coverAddressSchema = z.strictObject({ address: z.string().max(2000) });

export const missingVolumesSearchSchema = z.strictObject({
    upTo: z.number().int().min(0).max(9999),
});
