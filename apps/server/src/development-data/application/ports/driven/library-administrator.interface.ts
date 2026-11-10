import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface LibraryAdministrator {
    find(): Promise<Actor | null>;
}
