import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ReturnOutcome } from '../../lending-input.js';

export interface RecordReturnsUseCase {
    // Records the return of the selected loans of one receiver, all together or none.
    execute(actor: Actor, loanIds: string[]): Promise<ReturnOutcome>;
}
