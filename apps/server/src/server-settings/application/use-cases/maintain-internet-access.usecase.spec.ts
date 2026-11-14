import { expect, it } from 'vitest';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { HttpsRuleMove } from '../services/https-rule-move.service.js';
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
        doubles.window,
        new HttpsRuleMove(doubles.rules, doubles.log),
        doubles.clock,
    );
}

it('recreates the router rule on every upkeep', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.router.opened).toEqual([{ externalPort: 3443, internalPort: 3443 }]);
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
it('renews through ARI, naming the certificate in use', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.tls.material = { chain: 'current chain', key: 'current key' };
    doubles.clock.time = halfLife;

    await subject.execute();

    expect(doubles.authority.replaced).toEqual(['current chain']);
});
it('names no certificate to replace for a new public address', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.tls.material = { chain: 'current chain', key: 'current key' };
    doubles.router.connection = { mapping: 'upnp', externalAddress: '82.66.118.77' };

    await subject.execute();

    expect(doubles.authority.replaced).toEqual([null]);
});
it('names no certificate to replace for a domain name saved since', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.tls.material = { chain: 'current chain', key: 'current key' };
    doubles.names.name = 'home.example.fr';

    await subject.execute();

    expect(doubles.authority.replaced).toEqual([null]);
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
    ]).toEqual(['active', publicAddress, 'no-router']);
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
it('tries the router rule again at the next run, without waiting longer', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.router.connection = null;

    await subject.execute();

    expect([doubles.store.current.failedAttempts, doubles.store.current.nextAttemptAt]).toEqual([
        0,
        null,
    ]);
});
it('renews the router rule while the certificate work waits after a failure', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'authority-unavailable', at: '2026-11-08T09:00:00.000Z' },
            failedAttempts: 1,
            nextAttemptAt: '2026-11-08T11:00:00.000Z',
        }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([
        doubles.router.opened,
        doubles.store.current.failure?.reason,
        doubles.store.current.nextAttemptAt,
    ]).toEqual([
        [{ externalPort: 3443, internalPort: 3443 }],
        'authority-unavailable',
        '2026-11-08T11:00:00.000Z',
    ]);
});
it('renews no certificate before the waiting time after a failure is over', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failedAttempts: 1,
            nextAttemptAt: '2027-01-01T00:00:00.000Z',
        }),
    );
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;

    await subject.execute();

    expect(doubles.authority.requested).toEqual([]);
});
it('clears a router rule failure while the certificate work waits', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'no-router', at: '2026-11-08T09:00:00.000Z' },
            failedAttempts: 1,
            nextAttemptAt: '2026-11-08T11:00:00.000Z',
        }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.store.current.failure).toBeNull();
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
it('keeps no port 443 rule between checks', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.journal).toEqual(['open 3443 -> 3443']);
});
it('closes port 443 left open by a check cut short by a restart', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ phase: 'setting-up', step: 'certificate' }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.router.closed).toEqual([{ externalPort: 443, internalPort: 3443 }]);
});
it('moves the former port 443 rule to the HTTPS port after the update', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active({ routerPort: 443 }));
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.journal).toEqual(['close 443', 'open 3443 -> 3443']);
});
it('tells the Admin about the new address after moving the rule', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active({ routerPort: 443 }));
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([doubles.store.current.routerPort, doubles.store.current.addressMoved]).toEqual([
        3443,
        true,
    ]);
});
it('moves the rule an Admin waits to add by hand to the new HTTPS port', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            phase: 'waiting-for-port',
            mapping: 'manual',
            certificate: null,
            routerPort: 443,
        }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([doubles.store.current.routerPort, doubles.router.closed]).toEqual([3443, []]);
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
it('reports the kept rule and its public address', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'kept', address: publicAddress, problem: null });
});
it('reports a kept rule with the certificate failure still shown', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.refusal = 'authority-unavailable';

    const outcome = await subject.execute();

    expect(outcome).toEqual({
        rule: 'kept',
        address: publicAddress,
        problem: 'authority-unavailable',
    });
});
it('reports a rule that could not be kept', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.router.connection = null;

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'failed', reason: 'no-router' });
});
it('reports an unexpected certificate error with the rule kept', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.failure = new Error('network down');

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'kept', address: publicAddress, problem: 'setup-failed' });
});
it('reports no rule while internet access is off', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'none' });
});
it('asks Let’s Encrypt nothing before its date after a rate limit', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ retryAfter: '2026-11-12T23:30:00.000Z' }),
    );
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;

    await subject.execute();

    expect(doubles.authority.requested).toEqual([]);
});
it('waits for Let’s Encrypt’s date after a rate-limited renewal', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.refusal = 'rate-limited';
    doubles.authority.retryAfter = '2026-11-12T23:30:00.000Z';

    await subject.execute();

    expect([doubles.store.current.retryAfter, doubles.store.current.nextAttemptAt]).toEqual([
        '2026-11-12T23:30:00.000Z',
        '2026-11-12T23:30:00.000Z',
    ]);
});
it('stops trying the certificate after a failed check, until the Admin checks again', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.refusal = 'not-reachable';
    await subject.execute();
    doubles.clock.time = new Date('2026-11-12T18:00:00.000Z');

    await subject.execute();

    expect([doubles.authority.requested.length, doubles.store.current.awaitingCheck]).toEqual([
        1,
        true,
    ]);
});
it('keeps the router rule while the certificate waits for the Admin', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'not-reachable', at: '2026-11-08T10:00:00.000Z' },
            awaitingCheck: true,
        }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect(doubles.router.opened).toEqual([{ externalPort: 3443, internalPort: 3443 }]);
});
it('records a failed check for the estimate', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.clock.time = halfLife;
    doubles.authority.refusal = 'not-reachable';

    await subject.execute();

    expect(doubles.store.current.history).toEqual([
        { name: publicAddress, at: halfLife.toISOString(), kind: 'failed-check' },
    ]);
});
it('records no ARI renewal for the estimate', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.tls.material = { chain: 'current chain', key: 'current key' };
    doubles.clock.time = halfLife;

    await subject.execute();

    expect(doubles.store.current.history).toEqual([]);
});
it('ends a check while active cut short by a restart', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ step: 'certificate', awaitingCheck: true }),
    );
    const subject = subjectFor(doubles);

    await subject.execute();

    expect([doubles.store.current.phase, doubles.store.current.step]).toEqual(['active', null]);
});
