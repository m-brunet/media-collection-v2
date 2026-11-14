import type { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { EventLog } from '../ports/driven/event-log.interface.js';
import type { RouterRules } from './router-rules.service.js';

export class HttpsRuleMove {
    constructor(
        private readonly rules: RouterRules,
        private readonly log: EventLog,
    ) {}

    needed(access: InternetAccess, httpsPort: number): boolean {
        return (
            (access.phase === 'active' || access.phase === 'waiting-for-port') &&
            access.routerPort !== httpsPort
        );
    }

    async to(access: InternetAccess, httpsPort: number): Promise<void> {
        const former = access.routerPort;

        if (access.automatic && former !== null) {
            await this.rules.close({ externalPort: former, internalPort: former });
        }

        access.ruleMoved(httpsPort);
        this.log.write(
            'Internet access: HTTPS router rule moved from port ' +
                former +
                ' to port ' +
                httpsPort +
                (access.automatic ? '' : ', a rule added by hand to change in the router'),
        );
    }
}
