import { expect, it } from 'vitest';
import type { UpnpClient, UpnpMapOptions } from '@xmcl/nat-api';
import { UpnpRouterGateway } from './upnp-router-gateway.adapter.js';

// A stand-in for the library's client. Like the library, each call searches the router again
// through `findGateway`; `answers` says whether each search of this client gets an answer.
class FakeClient {
    searches = 0;
    destroyed = false;
    maps: UpnpMapOptions[] = [];

    constructor(
        private readonly answers: boolean[],
        private readonly refusedLeases: number[] = [],
    ) {}

    async findGateway(): Promise<{ device: object; address: object }> {
        const answered = this.answers[this.searches] ?? false;

        this.searches++;

        if (!answered) {
            throw new Error('Fail to find gateway.');
        }

        return { device: {}, address: { address: '192.168.1.20' } };
    }

    async externalIp(): Promise<string> {
        await this.findGateway();

        return '82.66.118.204';
    }

    async map(options: UpnpMapOptions): Promise<void> {
        await this.findGateway();
        this.maps.push(options);

        if (this.refusedLeases.includes(options.ttl ?? -1)) {
            throw new Error('OnlyPermanentLeasesSupported');
        }
    }

    async unmap(): Promise<boolean> {
        await this.findGateway();

        return true;
    }

    destroy(): void {
        this.destroyed = true;
    }
}

function gateway(clients: FakeClient[]): UpnpRouterGateway {
    const queue = [...clients];

    return new UpnpRouterGateway(
        () => Promise.resolve(queue.shift() as unknown as UpnpClient),
        3,
        0,
    );
}

const rule = { externalPort: 8080, internalPort: 8080 };

it('finds the router and its external address', async () => {
    const client = new FakeClient([true]);

    const connection = await gateway([client]).find();

    expect(connection).toEqual({ mapping: 'upnp', externalAddress: '82.66.118.204' });
    expect(client.destroyed).toBe(true);
});
it('searches the router once per call, then keeps the router it found', async () => {
    const client = new FakeClient([true, false]);

    const opened = await gateway([client]).open(rule);

    expect(opened).toBe(true);
    expect(client.searches).toBe(1);
});
it('asks again when the router does not answer the first search', async () => {
    const missed = new FakeClient([false]);
    const answered = new FakeClient([true]);

    const connection = await gateway([missed, answered]).find();

    expect(connection?.externalAddress).toBe('82.66.118.204');
    expect(missed.destroyed).toBe(true);
    expect(answered.destroyed).toBe(true);
});
it('finds no router after three searches without an answer', async () => {
    const clients = [new FakeClient([false]), new FakeClient([false]), new FakeClient([false])];

    const connection = await gateway(clients).find();

    expect(connection).toBeNull();
    expect(clients.every((client) => client.destroyed && client.searches === 1)).toBe(true);
});
it('opens the rule with a two-hour lease', async () => {
    const client = new FakeClient([true]);

    const opened = await gateway([client]).open(rule);

    expect(opened).toBe(true);
    expect(client.maps).toEqual([
        { description: 'Media Collection', protocol: 'tcp', public: 8080, private: 8080, ttl: 7200 },
    ]);
});
it('opens a permanent rule when the router refuses the lease', async () => {
    const client = new FakeClient([true], [7200]);

    const opened = await gateway([client]).open(rule);

    expect(opened).toBe(true);
    expect(client.maps.map((map) => map.ttl)).toEqual([7200, 0]);
});
it('reports a refused rule', async () => {
    const client = new FakeClient([true], [7200, 0]);

    const opened = await gateway([client]).open(rule);

    expect(opened).toBe(false);
    expect(client.destroyed).toBe(true);
});
it('cannot open the rule without a router', async () => {
    const clients = [new FakeClient([false]), new FakeClient([false]), new FakeClient([false])];

    const opened = await gateway(clients).open(rule);

    expect(opened).toBe(false);
});
