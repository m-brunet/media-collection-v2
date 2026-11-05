import { z } from 'zod';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

// Request shapes only; the locations domain checks the actual rules and explains refusals.
export const locationNameSchema = z.strictObject({ name: z.string().max(400) });

export const shelfChangesSchema = z
    .strictObject({
        name: z.string().max(400).optional(),
        bookcaseId: idSchema.optional(),
    })
    .refine((changes) => changes.name !== undefined || changes.bookcaseId !== undefined);

export const locationIdSchema = idSchema;
