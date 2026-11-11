import type { InternetAccessFailureReason } from '../../../domain/entities/internet-access.entity.js';

export type RuleUpkeepOutcome =
    | { rule: 'none' }
    | { rule: 'kept'; address: string; problem: InternetAccessFailureReason | null }
    | { rule: 'failed'; reason: InternetAccessFailureReason };

export interface MaintainInternetAccessUseCase {
    execute(): Promise<RuleUpkeepOutcome>;
}
