import type { PortRule } from './port-rule.interface.js';
import type { RouterConnection } from './router-connection.interface.js';

export interface RouterGateway {
    find(): Promise<RouterConnection | null>;
    open(rule: PortRule): Promise<boolean>;
    close(rule: PortRule): Promise<void>;
}
