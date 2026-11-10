import type {
    AttemptAllowances,
    InternetAccessState,
} from '../../../domain/entities/internet-access.entity.js';
import type { ManualPortRule } from './manual-port-rule.interface.js';

export interface InternetAccessView extends Omit<InternetAccessState, 'history'> {
    // What Let's Encrypt probably still allows for the name, after a failure; null before.
    allowances: AttemptAllowances | null;
    // The address phones open (domain name, else public address), once the certificate is in use.
    origin: string | null;
    manualRule: ManualPortRule | null;
}
