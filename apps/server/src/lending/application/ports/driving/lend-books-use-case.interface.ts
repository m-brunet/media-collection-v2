import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { LendingOutcome, LendRequest } from '../../lending-input.js';

export interface LendBooksUseCase {
    // Lends the selected books to one receiver, all together or none.
    execute(actor: Actor, request: LendRequest): Promise<LendingOutcome>;
}
