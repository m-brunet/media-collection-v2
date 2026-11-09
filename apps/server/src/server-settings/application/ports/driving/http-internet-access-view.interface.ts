import type { HttpInternetAccessState } from '../../../domain/entities/http-internet-access.entity.js';
import type { ManualPortRule } from './manual-port-rule.interface.js';

export interface HttpInternetAccessView extends HttpInternetAccessState {
    // The address phones open while it is open: the domain name, else the public address.
    origin: string | null;
    // What to enter in the router when the application could not add the rule.
    manualRule: ManualPortRule | null;
}
