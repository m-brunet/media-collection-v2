import type { RuleUpkeepOutcome } from './maintain-internet-access-use-case.interface.js';

// The HTTP rule upkeep run by the application itself: no actor.
export interface MaintainHttpInternetAccessUseCase {
    execute(): Promise<RuleUpkeepOutcome>;
}
