import type { Actor } from '../../../domain/actor.helper.js';

export interface SessionRenewal {
    renew(actor: Actor): Promise<string>;
}
