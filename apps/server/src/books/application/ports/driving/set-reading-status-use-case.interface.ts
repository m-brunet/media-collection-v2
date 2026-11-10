import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SetReadingStatusUseCase {
    execute(actor: Actor, bookId: string, read: boolean): Promise<{ read: boolean }>;
}
