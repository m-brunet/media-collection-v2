import { expect, it } from 'vitest';
import { HttpInternetAccess } from '../../domain/entities/http-internet-access.entity.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';

function startedDoubles() {
    const access = InternetAccess.off();

    access.start(null);

    return InternetAccessDoubles.setup(access.snapshot);
}

it('opens the router port, gets the certificate and activates internet access', async () => {
    const { setup, store } = startedDoubles();

    await setup.run();

    expect([
        store.current.phase,
        store.current.mapping,
        store.current.certificate?.address,
    ]).toEqual(['active', 'upnp', publicAddress]);
});
it('saves each step so the page can follow the setup', async () => {
    const { setup, store } = startedDoubles();

    await setup.run();

    expect(store.phases).toEqual(['setting-up:port', 'setting-up:certificate', 'active']);
});
it('forwards external port 443 to the HTTPS listening port', async () => {
    const { setup, router } = startedDoubles();

    await setup.run();

    expect(router.opened).toEqual([{ externalPort: 443, internalPort: 3443 }]);
});
it('switches HTTPS on with the new certificate, without a restart', async () => {
    const { setup, https, tls } = startedDoubles();

    await setup.run();

    expect([await tls.read(), tls.material?.chain, https.installed]).toEqual([
        { enabled: true, port: 3443, hasCertificate: true },
        'chain for ' + publicAddress,
        [{ port: 3443, chain: 'chain for ' + publicAddress }],
    ]);
});
it('starts the HTTPS listener before asking for the certificate', async () => {
    const { setup, https } = startedDoubles();

    await setup.run();

    expect(https.started).toEqual([3443]);
});
it('waits for a manual rule when no router answers', async () => {
    const { setup, store, router } = startedDoubles();

    router.connection = null;

    await setup.run();

    expect([store.current.phase, store.current.mapping, store.current.failure?.reason]).toEqual([
        'waiting-for-port',
        'manual',
        'no-router',
    ]);
});
it('stops when neither the router nor the public service knows the address', async () => {
    const { setup, store, router, probe } = startedDoubles();

    router.connection = null;
    probe.address = null;

    await setup.run();

    expect([store.current.phase, store.current.failure?.reason]).toEqual([
        'off',
        'public-address-unknown',
    ]);
});
it('stops behind a CGNAT without touching the router', async () => {
    const { setup, store, router } = startedDoubles();

    router.connection = { mapping: 'upnp', externalAddress: '100.72.1.9' };

    await setup.run();

    expect([store.current.failure?.reason, router.opened]).toEqual(['cgnat', []]);
});
it('waits for a manual rule when the router refuses port 443', async () => {
    const { setup, store, router } = startedDoubles();

    router.accepts = false;

    await setup.run();

    expect([store.current.phase, store.current.failure?.reason]).toEqual([
        'waiting-for-port',
        'port-refused',
    ]);
});
it('waits for a manual rule when Let’s Encrypt cannot reach the port', async () => {
    const { setup, store, authority } = startedDoubles();

    authority.refusal = 'not-reachable';

    await setup.run();

    expect([store.current.phase, store.current.failure?.reason]).toEqual([
        'waiting-for-port',
        'not-reachable',
    ]);
});
it('stops when Let’s Encrypt limits the requests', async () => {
    const { setup, store, authority } = startedDoubles();

    authority.refusal = 'rate-limited';

    await setup.run();

    expect([store.current.phase, store.current.failure?.reason]).toEqual(['off', 'rate-limited']);
});
it('stops without asking for a certificate when HTTPS cannot start', async () => {
    const { setup, store, https, authority } = startedDoubles();

    https.available = false;

    await setup.run();

    expect([store.current.failure?.reason, authority.requested]).toEqual(['https-unavailable', []]);
});
it('stops cleanly after an unexpected error', async () => {
    const { setup, store, authority } = startedDoubles();

    authority.failure = new Error('network down');

    await setup.run();

    expect([store.current.phase, store.current.failure?.reason]).toEqual(['off', 'setup-failed']);
});
it('is no longer running once the setup ended', async () => {
    const { setup } = startedDoubles();

    await setup.run();

    expect(setup.running).toBe(false);
});
it('checks a manual rule by getting the certificate only', async () => {
    const access = InternetAccess.off();

    access.start(null);
    access.portNeeded(publicAddress, 'no-router', new Date('2026-11-08T10:00:00.000Z'));
    access.check();
    const { setup, store, router } = InternetAccessDoubles.setup(access.snapshot);

    await setup.check();

    expect([store.current.phase, store.current.mapping, router.opened]).toEqual([
        'active',
        'manual',
        [],
    ]);
});

function startedWithDomain() {
    const access = InternetAccess.off();

    access.start('home.example.fr');

    return InternetAccessDoubles.setup(access.snapshot);
}

it('gets a certificate for the domain name', async () => {
    const { setup, store, authority } = startedWithDomain();

    await setup.run();

    expect([store.current.phase, store.current.certificate?.address, authority.subjects]).toEqual([
        'active',
        'home.example.fr',
        [{ kind: 'domain', name: 'home.example.fr' }],
    ]);
});
it('asks for an address certificate without a domain name', async () => {
    const { setup, authority } = startedDoubles();

    await setup.run();

    expect(authority.subjects).toEqual([{ kind: 'address', name: publicAddress }]);
});
it('checks that the domain name points to the public address', async () => {
    const { setup, resolver } = startedWithDomain();

    await setup.run();

    expect(resolver.asked).toEqual(['home.example.fr']);
});
it('stops when the domain name points elsewhere, before asking Let’s Encrypt', async () => {
    const { setup, store, resolver, authority } = startedWithDomain();

    resolver.answer = ['82.66.118.77'];

    await setup.run();

    expect([
        store.current.phase,
        store.current.failure?.reason,
        store.current.domain,
        authority.requested,
    ]).toEqual(['off', 'domain-mismatch', 'home.example.fr', []]);
});
it('stops when the domain name has no address', async () => {
    const { setup, store, resolver } = startedWithDomain();

    resolver.answer = [];

    await setup.run();

    expect([store.current.phase, store.current.failure?.reason]).toEqual([
        'off',
        'domain-unresolved',
    ]);
});

it('closes HTTP to the internet once HTTPS works', async () => {
    const doubles = startedDoubles();

    await doubles.http.save(new HttpInternetAccess(InternetAccessDoubles.httpOpen()));

    await doubles.setup.run();

    expect([
        doubles.http.current.phase,
        doubles.http.current.closedByHttps,
        doubles.router.closed,
    ]).toEqual(['off', true, [{ externalPort: 34345, internalPort: 34345 }]]);
});
it('keeps HTTP open while HTTPS waits for a manual router rule', async () => {
    const doubles = startedDoubles();

    await doubles.http.save(new HttpInternetAccess(InternetAccessDoubles.httpOpen()));
    doubles.router.accepts = false;

    await doubles.setup.run();

    expect(doubles.http.current.phase).toBe('open');
});
it('keeps HTTP open when the certificate cannot be issued', async () => {
    const doubles = startedDoubles();

    await doubles.http.save(new HttpInternetAccess(InternetAccessDoubles.httpOpen()));
    doubles.authority.refusal = 'rate-limited';

    await doubles.setup.run();

    expect(doubles.http.current.phase).toBe('open');
});
