import type { HttpInternetAccessState } from '../../../domain/entities/http-internet-access.entity.js';
import type { ManualPortRule } from './manual-port-rule.interface.js';

export interface HttpInternetAccessView extends HttpInternetAccessState {
    origin: string | null;
    manualRule: ManualPortRule | null;
}
