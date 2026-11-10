import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { ReturnOutcome } from '../../lending-input.js';

export interface RecordReturnsUseCase {
    execute(actor: Actor, loanIds: string[]): Promise<ReturnOutcome>;
}
