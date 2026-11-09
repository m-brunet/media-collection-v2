import { expect, it } from 'vitest';
import { HttpInternetAccess } from '../../domain/entities/http-internet-access.entity.js';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';

function openAccess(): HttpInternetAccess {
    return new HttpInternetAccess(InternetAccessDoubles.httpOpen());
}

it('opens the HTTP port on the router, same port outside and inside', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    await forwarding.open(access);

    expect([access.snapshot, router.opened]).toEqual([
        { phase: 'open', mapping: 'upnp', publicAddress, failure: null, closedByHttps: false },
        [{ externalPort: 34345, internalPort: 34345 }],
    ]);
});
it('gives the rule to add by hand when the router refuses it', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    router.accepts = false;

    await forwarding.open(access);

    expect([access.phase, access.snapshot.mapping, access.snapshot.failure?.reason]).toEqual([
        'open',
        'manual',
        'port-refused',
    ]);
});
it('gives the rule to add by hand with the public service address without a router', async () => {
    const { forwarding, router, probe } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    router.connection = null;
    probe.address = '82.66.1.1';

    await forwarding.open(access);

    expect([
        access.snapshot.mapping,
        access.publicAddress,
        access.snapshot.failure?.reason,
    ]).toEqual(['manual', '82.66.1.1', 'no-router']);
});
it('stays off when the public address cannot be found', async () => {
    const { forwarding, router, probe } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    router.connection = null;
    probe.address = null;

    await forwarding.open(access);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual([
        'off',
        'public-address-unknown',
    ]);
});
it('stays off without opening a rule when the provider shares the address', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    router.connection = { mapping: 'upnp', externalAddress: '100.70.1.2' };

    await forwarding.open(access);

    expect([access.phase, access.snapshot.failure?.reason, router.opened]).toEqual([
        'off',
        'cgnat',
        [],
    ]);
});
it('removes its router rule when closing', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = openAccess();

    await forwarding.close(access, false);

    expect([access.phase, router.closed]).toEqual([
        'off',
        [{ externalPort: 34345, internalPort: 34345 }],
    ]);
});
it('leaves a rule added by hand to the Admin when closing', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    access.openedByHand(publicAddress, 'no-router', new Date());

    await forwarding.close(access, false);

    expect([access.phase, router.closed]).toEqual(['off', []]);
});
it('recreates the rule and follows a new public address in the upkeep', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = openAccess();

    router.connection = { mapping: 'upnp', externalAddress: '82.66.118.77' };

    await forwarding.refresh(access);

    expect([access.publicAddress, router.opened.length]).toEqual(['82.66.118.77', 1]);
});
it('shows an upkeep failure when the router no longer answers', async () => {
    const { forwarding, router } = InternetAccessDoubles.setup();
    const access = openAccess();

    router.connection = null;

    await forwarding.refresh(access);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual(['open', 'no-router']);
});
it('follows the public address of a rule by hand in the upkeep', async () => {
    const { forwarding, probe, router } = InternetAccessDoubles.setup();
    const access = HttpInternetAccess.off();

    access.openedByHand(publicAddress, 'no-router', new Date());
    probe.address = '82.66.118.77';

    await forwarding.refresh(access);

    expect([access.publicAddress, router.opened]).toEqual(['82.66.118.77', []]);
});
