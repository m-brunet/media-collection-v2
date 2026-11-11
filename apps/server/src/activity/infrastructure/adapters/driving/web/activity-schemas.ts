import { z } from 'zod';

export const activityQuerySchema = z.strictObject({
    before: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z_[0-9a-fA-F-]{36}$/)
        .refine((value) => !Number.isNaN(Date.parse(value.slice(0, 24))))
        .transform((value) => ({
            occurredAt: value.slice(0, 24),
            operationId: value.slice(25).toLowerCase(),
        }))
        .optional(),
});
