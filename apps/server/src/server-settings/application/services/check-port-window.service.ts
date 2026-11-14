import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { EventLog } from '../ports/driven/event-log.interface.js';
import type { PortRule } from '../ports/driven/port-rule.interface.js';
import type { RouterRules } from './router-rules.service.js';

export class CheckPortWindow {
    private static readonly prefix = 'Let’s Encrypt check: ';

    constructor(
        private readonly rules: RouterRules,
        private readonly log: EventLog,
    ) {}

    async around<T>(
        access: InternetAccess,
        httpsPort: number,
        check: () => Promise<T>,
    ): Promise<T> {
        if (!access.automatic) {
            return check();
        }

        const opened = await this.rules.open(CheckPortWindow.rule(httpsPort));

        this.log.write(
            CheckPortWindow.prefix +
                (opened
                    ? 'port 443 opened on the router to port ' + httpsPort
                    : 'the router refused to open port 443, checking anyway'),
        );

        try {
            return await check();
        } finally {
            await this.close(httpsPort);
        }
    }

    async close(httpsPort: number): Promise<void> {
        await this.rules.close(CheckPortWindow.rule(httpsPort));
        this.log.write(CheckPortWindow.prefix + 'port 443 closed on the router');
    }

    private static rule(httpsPort: number): PortRule {
        return { externalPort: InternetAccess.checkPort, internalPort: httpsPort };
    }
}
