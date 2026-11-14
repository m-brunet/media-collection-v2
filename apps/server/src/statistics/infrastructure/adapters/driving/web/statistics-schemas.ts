import { z } from 'zod';

export const statisticsQuerySchema = z.strictObject({
    category: z.enum(['books', 'manga', 'comics']).optional(),
});
