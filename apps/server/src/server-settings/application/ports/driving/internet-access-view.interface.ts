import type { InternetAccessState } from '../../../domain/entities/internet-access.entity.js';
import type { ManualPortRule } from './manual-port-rule.interface.js';

export interface InternetAccessView extends InternetAccessState {
    // The address phones open (domain name, else public address), once the certificate is in use.
    origin: string | null;
    manualRule: ManualPortRule | null;
}
