import { z } from 'zod';

// Stored ids are lowercase UUIDs, so an uppercase spelling of the same UUID designates the same
// record.
export const idSchema = z.uuid().transform((id) => id.toLowerCase());
