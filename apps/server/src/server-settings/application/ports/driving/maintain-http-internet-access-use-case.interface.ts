import type { RuleUpkeepOutcome } from './maintain-internet-access-use-case.interface.js';

export interface MaintainHttpInternetAccessUseCase {
    execute(): Promise<RuleUpkeepOutcome>;
}
