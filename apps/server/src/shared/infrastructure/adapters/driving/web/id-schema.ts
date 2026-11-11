import { z } from 'zod';

export const idSchema = z.uuid().transform((id) => id.toLowerCase());
