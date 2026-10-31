import type { Actor } from '../../../domain/actor.helper.js';

export interface Authentication {
    authenticate(token: string): Promise<Actor>;
}
