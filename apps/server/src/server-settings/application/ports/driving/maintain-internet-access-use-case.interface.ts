import type { InternetAccessFailureReason } from '../../../domain/entities/internet-access.entity.js';

// What an upkeep run did with its router rule. `problem`: another failure still shown once the
// rule is kept (the certificate or the domain name).
export type RuleUpkeepOutcome =
    | { rule: 'none' }
    | { rule: 'kept'; address: string; problem: InternetAccessFailureReason | null }
    | { rule: 'failed'; reason: InternetAccessFailureReason };

// The upkeep run by the application itself: no actor.
export interface MaintainInternetAccessUseCase {
    execute(): Promise<RuleUpkeepOutcome>;
}
