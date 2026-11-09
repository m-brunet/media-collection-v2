import { expect, it } from 'vitest';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { MaintainInternetAccess } from './maintain-internet-access.usecase.js';

const halfLife = new Date('2026-11-11T18:00:00.000Z');

function subjectFor(doubles: ReturnType<typeof InternetAccessDoubles.setup>) {
    return new MaintainInternetAccess(
        doubles.store,
        doubles.rules,
        doubles.tls,
        doubles.setup,
        doubles.domains,
        doubles.names,
        doubles.clock,
    );
}

it('recreates the router rule on every upkeep', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.router.opened).toEqual([{ externalPort: 443, internalPort: 3443 }]);
});
it('keeps a fresh certificate', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.authority.requested).toEqual([]);
});
it('renews the certificate at half of its lifetime and installs it live', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;

    await subject.execute();

    expect([doubles.store.current.certificate?.issuedAt, doubles.https.installed.length]).toEqual([
        halfLife.toISOString(),
        1,
    ]);
});
it('follows a new public address with a new certificate', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.router.connection = { mapping: 'upnp', externalAddress: '82.66.118.77' };

    await subject.execute();

    expect([
        doubles.store.current.publicAddress,
        doubles.store.current.certificate?.address,
    ]).toEqual(['82.66.118.77', '82.66.118.77']);
});
it('reads the public address from the public service for a manual rule', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ mapping: 'manual' }),
    );
    const subject = subjectFor(doubles);

    doubles.probe.address = '82.66.118.77';

    await subject.execute();

    expect([doubles.router.opened, doubles.store.current.publicAddress]).toEqual([
        [],
        '82.66.118.77',
    ]);
});
it('keeps the certificate when the router no longer answers', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.router.connection = null;

    await subject.execute();

    expect([
        doubles.store.current.phase,
        doubles.store.current.certificate?.address,
        doubles.store.current.failure?.reason,
        doubles.store.current.nextAttemptAt,
    ]).toEqual(['active', publicAddress, 'no-router', '2026-11-08T11:00:00.000Z']);
});
it('reports a refused router rule', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.router.accepts = false;

    await subject.execute();

    expect(doubles.store.current.failure?.reason).toBe('port-refused');
});
it('reports a provider that moved the home behind a CGNAT', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.router.connection = { mapping: 'upnp', externalAddress: '100.80.0.3' };

    await subject.execute();

    expect([doubles.store.current.failure?.reason, doubles.store.current.publicAddress]).toEqual([
        'cgnat',
        publicAddress,
    ]);
});
it('reports a refused renewal and keeps the current certificate', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.refusal = 'authority-unavailable';

    await subject.execute();

    expect([
        doubles.store.current.failure?.reason,
        doubles.store.current.certificate?.issuedAt,
    ]).toEqual(['authority-unavailable', '2026-11-08T10:00:00.000Z']);
});
it('reports an unexpected error as a failed upkeep', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.failure = new Error('network down');

    await subject.execute();

    expect(doubles.store.current.failure?.reason).toBe('setup-failed');
});
it('waits for the next attempt after a failure', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failedAttempts: 1,
            nextAttemptAt: '2026-11-08T11:00:00.000Z',
        }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.router.opened).toEqual([]);
});
it('clears the failure after a successful upkeep', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'no-router', at: '2026-11-08T09:00:00.000Z' },
            failedAttempts: 1,
            nextAttemptAt: '2026-11-08T10:00:00.000Z',
        }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([doubles.store.current.failure, doubles.store.current.failedAttempts]).toEqual([
        null,
        0,
    ]);
});
it('ends a setup cut short by a restart', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ phase: 'setting-up', step: 'certificate' }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([doubles.store.current.phase, doubles.store.current.failure?.reason]).toEqual([
        'off',
        'setup-failed',
    ]);
});
it('does nothing while internet access is off', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([doubles.router.opened, doubles.store.phases]).toEqual([[], []]);
});

function withSavedDomain(doubles: ReturnType<typeof InternetAccessDoubles.setup>) {
    doubles.names.name = 'home.example.fr';

    return doubles;
}

function activeWithDomain() {
    return InternetAccessDoubles.active({
        domain: 'home.example.fr',
        certificate: {
            address: 'home.example.fr',
            issuedAt: '2026-11-08T10:00:00.000Z',
            expiresAt: '2027-02-06T10:00:00.000Z',
        },
    });
}

it('keeps the domain certificate when the public address changes', async () => {
    const doubles = withSavedDomain(InternetAccessDoubles.setup(activeWithDomain()));
    const subject = subjectFor(doubles);

    doubles.router.connection = { mapping: 'upnp', externalAddress: '82.66.118.77' };
    doubles.resolver.answer = ['82.66.118.77'];

    await subject.execute();

    expect([
        doubles.store.current.publicAddress,
        doubles.store.current.failure,
        doubles.authority.requested,
    ]).toEqual(['82.66.118.77', null, []]);
});
it('warns when the domain name does not follow the public address', async () => {
    const doubles = withSavedDomain(InternetAccessDoubles.setup(activeWithDomain()));
    const subject = subjectFor(doubles);

    doubles.router.connection = { mapping: 'upnp', externalAddress: '82.66.118.77' };

    await subject.execute();

    expect([
        doubles.store.current.phase,
        doubles.store.current.failure?.reason,
        doubles.store.current.certificate?.address,
        doubles.store.current.nextAttemptAt,
    ]).toEqual(['active', 'domain-mismatch', 'home.example.fr', '2026-11-08T11:00:00.000Z']);
});
it('renews the domain certificate at two thirds of its lifetime', async () => {
    const doubles = withSavedDomain(InternetAccessDoubles.setup(activeWithDomain()));
    const subject = subjectFor(doubles);
    const renewal = new Date('2027-01-07T10:00:00.000Z');

    doubles.clock.time = renewal;

    await subject.execute();

    expect([doubles.authority.subjects, doubles.store.current.certificate?.issuedAt]).toEqual([
        [{ kind: 'domain', name: 'home.example.fr' }],
        renewal.toISOString(),
    ]);
});
it('keeps the domain certificate before two thirds of its lifetime', async () => {
    const doubles = withSavedDomain(InternetAccessDoubles.setup(activeWithDomain()));
    const subject = subjectFor(doubles);

    doubles.clock.time = new Date('2027-01-07T09:00:00.000Z');

    await subject.execute();

    expect(doubles.authority.requested).toEqual([]);
});
it('follows a domain name saved since the last certificate', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.names.name = 'home.example.fr';

    await subject.execute();

    expect([
        doubles.store.current.domain,
        doubles.store.current.certificate?.address,
        doubles.authority.subjects,
    ]).toEqual([
        'home.example.fr',
        'home.example.fr',
        [{ kind: 'domain', name: 'home.example.fr' }],
    ]);
});
