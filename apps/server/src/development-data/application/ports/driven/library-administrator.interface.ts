import type { Actor } from '../../../../shared/domain/actor.helper.js';

// The protected administrator account, which receives the imported books and V1 reading status.
export interface LibraryAdministrator {
    find(): Promise<Actor | null>;
}
