import { z } from 'zod';
import { bookFilterQuery } from '../../../../../shared/infrastructure/adapters/driving/web/book-filter-query.js';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

export const collectionListSchema = z.strictObject({
    search: z.string().max(400).default(''),
    direction: z.enum(['asc', 'desc']).default('asc'),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(48),
    finished: z
        .enum(['true', 'false'])
        .optional()
        .transform((value) => (value === undefined ? null : value === 'true')),
    dropped: z
        .literal('true')
        .optional()
        .transform((value) => value === 'true'),
    ...bookFilterQuery,
});

export const collectionNamesSchema = z.strictObject({ search: z.string().max(400).default('') });

export const collectionChangesSchema = z
    .strictObject({
        name: z.string().max(400).optional(),
        includesVolumeZero: z.boolean().optional(),
        category: z.enum(['books', 'manga', 'comics']).optional(),
    })
    .refine(
        (changes) =>
            changes.name !== undefined ||
            changes.includesVolumeZero !== undefined ||
            changes.category !== undefined,
    );

export const collectionIdSchema = idSchema;
