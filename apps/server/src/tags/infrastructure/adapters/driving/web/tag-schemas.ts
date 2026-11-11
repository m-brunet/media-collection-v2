import { z } from 'zod';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

export const tagSearchSchema = z.strictObject({ search: z.string().max(400).default('') });

export const tagNameSchema = z.strictObject({ name: z.string().max(400) });

export const tagIdSchema = idSchema;
