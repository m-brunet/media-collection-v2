import { z } from 'zod';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

export const locationNameSchema = z.strictObject({ name: z.string().max(400) });

export const bookcaseChangesSchema = z
    .strictObject({
        name: z.string().max(400).optional(),
        size: z.enum(['large', 'small']).optional(),
    })
    .refine((changes) => changes.name !== undefined || changes.size !== undefined);

export const shelfChangesSchema = z
    .strictObject({
        name: z.string().max(400).optional(),
        bookcaseId: idSchema.optional(),
    })
    .refine((changes) => changes.name !== undefined || changes.bookcaseId !== undefined);

export const locationIdSchema = idSchema;
