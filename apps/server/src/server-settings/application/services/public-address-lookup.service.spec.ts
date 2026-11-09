import { expect, it } from 'vitest';
import { FakeProbe, FakeRouter } from '../testing/internet-access-doubles.test-support.js';
import { PublicAddressLookup } from './public-address-lookup.service.js';

it('takes the public address from the router', async () => {
    const lookup = new PublicAddressLookup(
        new FakeRouter({ mapping: 'upnp', externalAddress: '82.66.118.204' }),
        new FakeProbe('82.66.1.1'),
    );

    const address = await lookup.current();

    expect(address).toBe('82.66.118.204');
});
it('asks the public service without a router', async () => {
    const lookup = new PublicAddressLookup(new FakeRouter(null), new FakeProbe('82.66.1.1'));

    const address = await lookup.current();

    expect(address).toBe('82.66.1.1');
});
it('cannot tell without a router or the public service', async () => {
    const lookup = new PublicAddressLookup(new FakeRouter(null), new FakeProbe(null));

    const address = await lookup.current();

    expect(address).toBeNull();
});
