import { z } from 'zod';
import { idSchema } from '../../../../../shared/infrastructure/adapters/driving/web/id-schema.js';

// Request shapes only; the lending domain checks the actual rules (at least one book, each once,
// receiver name) and explains refusals.
export const lendBooksSchema = z.strictObject({
    receiver: z.union([
        z.strictObject({ id: idSchema }),
        z.strictObject({ name: z.string().max(400), distinct: z.boolean().optional() }),
    ]),
    bookIds: z.array(idSchema).max(200),
});

export const recordReturnsSchema = z.strictObject({
    loanIds: z.array(idSchema).max(200),
});

export const activeLoansSchema = z.strictObject({
    search: z.string().max(400).default(''),
    receiver: idSchema.optional(),
});

export const receiverSearchSchema = z.strictObject({ search: z.string().max(400).default('') });
