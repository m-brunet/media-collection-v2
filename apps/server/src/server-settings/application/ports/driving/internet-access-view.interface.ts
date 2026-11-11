import type {
    AttemptAllowances,
    InternetAccessState,
} from '../../../domain/entities/internet-access.entity.js';
import type { ManualPortRule } from './manual-port-rule.interface.js';

export interface InternetAccessView extends Omit<InternetAccessState, 'history'> {
    allowances: AttemptAllowances | null;
    origin: string | null;
    manualRule: ManualPortRule | null;
}
