import type { HttpInternetAccessStore } from '../ports/driven/http-internet-access-store.interface.js';
import type { HttpPortForwarding } from './http-port-forwarding.service.js';

export class HttpInternetAccessClosing {
    constructor(
        private readonly store: HttpInternetAccessStore,
        private readonly forwarding: HttpPortForwarding,
    ) {}

    // A failure to remove the router rule still closes HTTP: it never undoes the HTTPS setup.
    async becauseHttpsWorks(): Promise<void> {
        const access = await this.store.read();

        if (access.phase !== 'open') {
            return;
        }

        await this.forwarding.close(access, true).catch(() => access.close(true));
        await this.store.save(access);
    }
}
