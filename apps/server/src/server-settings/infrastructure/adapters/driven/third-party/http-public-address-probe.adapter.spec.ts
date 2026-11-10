import { afterEach, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { HttpPublicAddressProbe } from './http-public-address-probe.adapter.js';

const servers: Server[] = [];

afterEach(async () => {
    await Promise.all(
        servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
    );
});

async function service(status: number, body: string): Promise<string> {
    const server = createServer((_request, response) => {
        response.statusCode = status;
        response.end(body);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    servers.push(server);

    return 'http://127.0.0.1:' + (server.address() as { port: number }).port;
}

it('reads the public address', async () => {
    const probe = new HttpPublicAddressProbe(await service(200, '82.66.118.204\n'));

    const address = await probe.current();

    expect(address).toBe('82.66.118.204');
});
it('knows nothing when the answer is not an IPv4 address', async () => {
    const probe = new HttpPublicAddressProbe(await service(200, '<html>maintenance</html>'));

    const address = await probe.current();

    expect(address).toBeNull();
});
it('knows nothing when the service fails', async () => {
    const probe = new HttpPublicAddressProbe(await service(503, '82.66.118.204'));

    const address = await probe.current();

    expect(address).toBeNull();
});
it('knows nothing when the service cannot be reached', async () => {
    const probe = new HttpPublicAddressProbe('http://127.0.0.1:1');

    const address = await probe.current();

    expect(address).toBeNull();
});
