import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { BookView } from '../../book-views.js';

export interface ReplaceCoverUseCase {
    execute(actor: Actor, bookId: string, image: Uint8Array): Promise<BookView>;
}
