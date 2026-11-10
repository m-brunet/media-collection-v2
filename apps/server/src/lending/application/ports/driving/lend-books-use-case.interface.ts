import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { LendingOutcome, LendRequest } from '../../lending-input.js';

export interface LendBooksUseCase {
    execute(actor: Actor, request: LendRequest): Promise<LendingOutcome>;
}
