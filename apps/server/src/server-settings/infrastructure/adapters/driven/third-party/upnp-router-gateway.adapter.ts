import { createUpnpClient } from '@xmcl/nat-api';
import type { UpnpClient } from '@xmcl/nat-api';
import type { PortRule } from '../../../../application/ports/driven/port-rule.interface.js';
import type { RouterConnection } from '../../../../application/ports/driven/router-connection.interface.js';
import type { RouterGateway } from '../../../../application/ports/driven/router-gateway.interface.js';

type Gateway = Awaited<ReturnType<UpnpClient['findGateway']>>;

// The home router through UPnP. Each call opens a short-lived client: the router may have
// restarted or changed since the last call.
export class UpnpRouterGateway implements RouterGateway {
    // The upkeep renews the rule well before this lease ends.
    private static readonly leaseSeconds = 2 * 60 * 60;
    private static readonly description = 'Media Collection';

    // The router search is one multicast question answered within 1.8 seconds, or not at all: a
    // missed answer is asked again before the call fails.
    constructor(
        private readonly connect: () => Promise<UpnpClient> = createUpnpClient,
        private readonly searches = 3,
        private readonly pause = 1000,
    ) {}

    async find(): Promise<RouterConnection | null> {
        return this.with(async (client) => {
            return { mapping: 'upnp' as const, externalAddress: await client.externalIp() };
        }).catch(() => null);
    }

    async open(rule: PortRule): Promise<boolean> {
        return this.with(async (client) => {
            const mapping = {
                description: UpnpRouterGateway.description,
                protocol: 'tcp' as const,
                public: rule.externalPort,
                private: rule.internalPort,
            };

            // Some routers only accept permanent rules; the upkeep still recreates them.
            await client
                .map({ ...mapping, ttl: UpnpRouterGateway.leaseSeconds })
                .catch(() => client.map({ ...mapping, ttl: 0 }));

            return true;
        }).catch(() => false);
    }

    async close(rule: PortRule): Promise<void> {
        await this.with((client) =>
            client.unmap({ protocol: 'tcp', public: rule.externalPort }),
        ).catch(() => undefined);
    }

    private async with<T>(work: (client: UpnpClient) => Promise<T>): Promise<T> {
        const client = await this.found();

        try {
            return await work(client);
        } finally {
            client.destroy();
        }
    }

    // A client that has found the router. The library searches again on each call (its cache
    // check is inverted), so the client keeps the router it found for the calls that follow.
    private async found(): Promise<UpnpClient> {
        for (let search = 1; ; search++) {
            const client = await this.connect();
            const gateway = await client.findGateway().catch((error: unknown) => {
                client.destroy();

                if (search >= this.searches) {
                    throw error;
                }

                return null;
            });

            if (gateway) {
                client.findGateway = (): Promise<Gateway> => Promise.resolve(gateway);

                return client;
            }

            await new Promise((resolve) => setTimeout(resolve, this.pause));
        }
    }
}
