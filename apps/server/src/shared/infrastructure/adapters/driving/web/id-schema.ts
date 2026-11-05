import { z } from 'zod';

// A record identity in a path, body or query. Stored ids are lowercase UUIDs, so an uppercase
// spelling of the same UUID designates the same record.
export const idSchema = z.uuid().transform((id) => id.toLowerCase());
