import type { PortRule } from './port-rule.interface.js';
import type { RouterConnection } from './router-connection.interface.js';

// The home router, reached with UPnP or NAT-PMP. `open` answers false when the router refuses the
// rule (port taken, ports under 1024 not allowed, port outside a shared address range).
export interface RouterGateway {
    find(): Promise<RouterConnection | null>;
    open(rule: PortRule): Promise<boolean>;
    close(rule: PortRule): Promise<void>;
}
