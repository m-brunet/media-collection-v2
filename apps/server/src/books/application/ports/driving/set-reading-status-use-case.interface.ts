import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SetReadingStatusUseCase {
    // Changes only the signed-in account's own status.
    execute(actor: Actor, bookId: string, read: boolean): Promise<{ read: boolean }>;
}
