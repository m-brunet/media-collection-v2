import { z } from 'zod';

// Request shapes only; the collections domain checks the actual rules and explains refusals.
export const collectionListSchema = z.strictObject({
    search: z.string().max(400).default(''),
    direction: z.enum(['asc', 'desc']).default('asc'),
    offset: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().min(1).max(100).default(48),
});

export const collectionNamesSchema = z.strictObject({ search: z.string().max(400).default('') });

export const collectionChangesSchema = z
    .strictObject({
        name: z.string().max(400).optional(),
        includesVolumeZero: z.boolean().optional(),
    })
    .refine((changes) => changes.name !== undefined || changes.includesVolumeZero !== undefined);

export const collectionIdSchema = z.uuid();
