import { expect, it } from 'vitest';
import { InternetAccess } from './internet-access.entity.js';
import type { InternetAccessState } from './internet-access.entity.js';

const now = new Date('2026-11-08T10:00:00.000Z');
const certificate = {
    address: '82.66.118.204',
    issuedAt: '2026-11-08T10:00:00.000Z',
    expiresAt: '2026-11-14T10:00:00.000Z',
};

function settingUp(): InternetAccess {
    const access = InternetAccess.off();

    access.start(null, 34443);

    return access;
}

function gettingCertificate(): InternetAccess {
    const access = settingUp();

    access.routerFound('upnp', '82.66.118.204', now);
    access.portOpened();

    return access;
}

function active(): InternetAccess {
    const access = gettingCertificate();

    access.activate(certificate);

    return access;
}

it('starts a setup by looking for the router', () => {
    const access = InternetAccess.off();

    access.start(null, 34443);

    expect([access.phase, access.snapshot.step]).toEqual(['setting-up', 'router']);
});
it('refuses a second setup while one runs', () => {
    const access = settingUp();

    const operation = () => access.start(null, 34443);

    expect(operation).toThrow('already being set up');
});
it('opens the port once the router reports a public address', () => {
    const access = settingUp();

    const usable = access.routerFound('upnp', '82.66.118.204', now);

    expect([usable, access.publicAddress, access.mapping, access.snapshot.step]).toEqual([
        true,
        '82.66.118.204',
        'upnp',
        'port',
    ]);
});
it('stops when the provider shares the address (CGNAT)', () => {
    const access = settingUp();

    const usable = access.routerFound('upnp', '100.70.1.2', now);

    expect([usable, access.phase, access.snapshot.failure?.reason]).toEqual([
        false,
        'off',
        'cgnat',
    ]);
});
it('stops when the router sits behind another router', () => {
    const access = settingUp();

    access.routerFound('nat-pmp', '192.168.0.12', now);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual(['off', 'double-nat']);
});
it('gets the certificate once the port is open', () => {
    const access = settingUp();

    access.routerFound('upnp', '82.66.118.204', now);

    access.portOpened();

    expect(access.snapshot.step).toBe('certificate');
});
it('waits for a manual router rule when the router refuses the port', () => {
    const access = settingUp();

    access.portNeeded('82.66.118.204', 'port-refused', now);

    expect([access.phase, access.mapping, access.snapshot.failure?.reason]).toEqual([
        'waiting-for-port',
        'manual',
        'port-refused',
    ]);
});
it('stops instead of waiting when the public service reports a CGNAT address', () => {
    const access = settingUp();

    access.portNeeded('100.64.3.4', 'no-router', now);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual(['off', 'cgnat']);
});
it('checks the manual rule again by getting the certificate', () => {
    const access = settingUp();

    access.portNeeded('82.66.118.204', 'no-router', now);

    access.check();

    expect([access.phase, access.snapshot.step, access.snapshot.failure]).toEqual([
        'setting-up',
        'certificate',
        null,
    ]);
});
it('has nothing to check when no rule is awaited', () => {
    const access = InternetAccess.off();

    const operation = () => access.check();

    expect(operation).toThrow('no router rule to check');
});
it('sends the Admin to the manual rule when Let’s Encrypt cannot reach the port', () => {
    const access = gettingCertificate();

    access.certificateRefused('not-reachable', now);

    expect([access.phase, access.mapping, access.snapshot.failure?.reason]).toEqual([
        'waiting-for-port',
        'upnp',
        'not-reachable',
    ]);
});
it('ends the setup without access when the setup cannot go further', () => {
    const access = gettingCertificate();

    access.stop('rate-limited', now);

    expect([access.phase, access.certificate, access.snapshot.failure?.reason]).toEqual([
        'off',
        null,
        'rate-limited',
    ]);
});
it('becomes active with a certificate for the public address', () => {
    const access = gettingCertificate();

    access.activate(certificate);

    expect([access.phase, access.certificate?.address, access.snapshot.step]).toEqual([
        'active',
        '82.66.118.204',
        null,
    ]);
});
it('refuses a certificate for another address', () => {
    const access = gettingCertificate();

    const operation = () => access.activate({ ...certificate, address: '82.66.118.205' });

    expect(operation).toThrow('public address');
});
it('refuses an active state without a certificate', () => {
    const state: InternetAccessState = {
        ...InternetAccess.off().snapshot,
        phase: 'active',
        mapping: 'upnp',
        publicAddress: '82.66.118.204',
        domain: null,
        routerPort: 34443,
    };

    const operation = () => new InternetAccess(state);

    expect(operation).toThrow('needs a certificate');
});
it('renews after a public address change', () => {
    const access = active();

    access.addressChanged('82.66.118.205');

    const due = access.renewalDue(new Date('2026-11-08T11:00:00.000Z'));

    expect(due).toBe(true);
});
it('does not renew a fresh certificate', () => {
    const access = active();

    const due = access.renewalDue(new Date('2026-11-08T11:00:00.000Z'));

    expect(due).toBe(false);
});
it('keeps the certificate after an upkeep failure', () => {
    const access = active();

    access.upkeepFailed('authority-unavailable', now);

    expect([access.phase, access.certificate?.address, access.snapshot.failure?.reason]).toEqual([
        'active',
        '82.66.118.204',
        'authority-unavailable',
    ]);
});
it('waits before the next upkeep after a failure', () => {
    const access = active();

    access.upkeepFailed('authority-unavailable', now);

    const due = access.upkeepDue(new Date('2026-11-08T10:59:59.000Z'));

    expect(due).toBe(false);
});
it('runs the next upkeep when the waiting time is over', () => {
    const access = active();

    access.upkeepFailed('authority-unavailable', now);

    const due = access.upkeepDue(new Date('2026-11-08T11:00:00.000Z'));

    expect(due).toBe(true);
});
it('clears the failure after a successful upkeep', () => {
    const access = active();

    access.upkeepFailed('rate-limited', now);

    access.upkeepSucceeded();

    expect([access.snapshot.failure, access.snapshot.failedAttempts]).toEqual([null, 0]);
});
it('shows a router rule failure without waiting longer', () => {
    const access = active();

    access.ruleFailed('no-router', now);

    expect([
        access.snapshot.failure?.reason,
        access.snapshot.failedAttempts,
        access.upkeepDue(now),
    ]).toEqual(['no-router', 0, true]);
});
it('clears a router rule failure once the rule is kept', () => {
    const access = active();

    access.ruleFailed('port-refused', now);

    access.ruleKept();

    expect(access.snapshot.failure).toBeNull();
});
it('keeps a certificate failure and its waiting time when the rule is kept', () => {
    const access = active();

    access.upkeepFailed('authority-unavailable', now);

    access.ruleKept();

    expect([access.snapshot.failure?.reason, access.snapshot.nextAttemptAt]).toEqual([
        'authority-unavailable',
        '2026-11-08T11:00:00.000Z',
    ]);
});
it('runs no upkeep while off', () => {
    const access = InternetAccess.off();

    const due = access.upkeepDue(now);

    expect(due).toBe(false);
});
it('forgets everything when turned off', () => {
    const access = active();

    access.turnOff();

    expect(access.snapshot).toEqual(InternetAccess.off().snapshot);
});
it('keeps the current certificate while a new setup runs', () => {
    const access = active();

    access.start(null, 34443);

    expect([access.phase, access.certificate?.address]).toEqual(['setting-up', '82.66.118.204']);
});
it('cannot be turned off while a setup runs', () => {
    const access = settingUp();

    const operation = () => access.turnOff();

    expect(operation).toThrow('Wait for the internet access setup');
});
it('ends a setup cut short by a restart', () => {
    const access = gettingCertificate();

    access.interrupted(now);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual(['off', 'setup-failed']);
});
it('leaves active access untouched after a restart', () => {
    const access = active();

    access.interrupted(now);

    expect(access.phase).toBe('active');
});

const domainCertificate = {
    address: 'home.example.fr',
    issuedAt: '2026-11-08T10:00:00.000Z',
    expiresAt: '2027-02-06T10:00:00.000Z',
};

function activeWithDomain(): InternetAccess {
    const access = InternetAccess.off();

    access.start('Home.Example.fr', 34443);
    access.routerFound('upnp', '82.66.118.204', now);
    access.portOpened();
    access.activate(domainCertificate);

    return access;
}

it('starts a setup with the domain name', () => {
    const access = InternetAccess.off();

    access.start(' Home.Example.FR ', 34443);

    expect([access.phase, access.domain]).toEqual(['setting-up', 'home.example.fr']);
});
it('starts a setup without a domain name when the field is blank', () => {
    const access = InternetAccess.off();

    access.start('', 34443);

    expect(access.domain).toBeNull();
});
it('refuses an invalid domain name', () => {
    const access = InternetAccess.off();

    const operation = () => access.start('https://home.example.fr', 34443);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a saved invalid domain name', () => {
    const state: InternetAccessState = { ...InternetAccess.off().snapshot, domain: 'Not valid' };

    const operation = () => new InternetAccess(state);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('names the certificate after the domain name', () => {
    const access = activeWithDomain();

    const name = access.certificateName;

    expect(name).toBe('home.example.fr');
});
it('names the certificate after the public address without a domain name', () => {
    const access = active();

    const name = access.certificateName;

    expect(name).toBe('82.66.118.204');
});
it('becomes active with a certificate for the domain name', () => {
    const access = activeWithDomain();

    const phase = access.phase;

    expect([phase, access.certificate?.address]).toEqual(['active', 'home.example.fr']);
});
it('refuses an address certificate when a domain name is set', () => {
    const access = InternetAccess.off();

    access.start('home.example.fr', 34443);
    access.routerFound('upnp', '82.66.118.204', now);
    access.portOpened();

    const operation = () => access.activate(certificate);

    expect(operation).toThrow('domain name or the public address');
});
it('keeps a domain certificate after a public address change', () => {
    const access = activeWithDomain();

    access.addressChanged('82.66.118.205');

    const due = access.renewalDue(new Date('2026-11-08T11:00:00.000Z'));

    expect(due).toBe(false);
});
it('keeps a domain certificate before two thirds of its lifetime', () => {
    const access = activeWithDomain();

    const due = access.renewalDue(new Date('2027-01-07T09:59:59.000Z'));

    expect(due).toBe(false);
});
it('renews a domain certificate at two thirds of its lifetime', () => {
    const access = activeWithDomain();

    const due = access.renewalDue(new Date('2027-01-07T10:00:00.000Z'));

    expect(due).toBe(true);
});
it('keeps the domain name when turned off', () => {
    const access = activeWithDomain();

    access.turnOff();

    expect([access.phase, access.domain, access.certificate]).toEqual([
        'off',
        'home.example.fr',
        null,
    ]);
});
it('keeps the domain name when the setup stops', () => {
    const access = InternetAccess.off();

    access.start('home.example.fr', 34443);

    access.stop('domain-mismatch', now);

    expect([access.phase, access.domain, access.snapshot.failure?.reason]).toEqual([
        'off',
        'home.example.fr',
        'domain-mismatch',
    ]);
});
it('follows another domain name while active', () => {
    const access = activeWithDomain();

    access.useDomain('library.example.fr');

    expect([access.certificateName, access.renewalDue(now)]).toEqual(['library.example.fr', true]);
});
it('goes back to the public address when the domain name is removed', () => {
    const access = activeWithDomain();

    access.useDomain(null);

    expect([access.certificateName, access.renewalDue(now)]).toEqual(['82.66.118.204', true]);
});
it('follows a domain name only while active', () => {
    const access = InternetAccess.off();

    const operation = () => access.useDomain('home.example.fr');

    expect(operation).toThrow('not active');
});
it('records a new certificate for the estimate', () => {
    const access = active();

    access.certificateIssued(false, now);

    expect(access.snapshot.history).toEqual([
        { name: '82.66.118.204', at: now.toISOString(), kind: 'certificate' },
    ]);
});
it('records no ARI renewal, which Let’s Encrypt does not count', () => {
    const access = active();

    access.certificateIssued(true, now);

    expect(access.snapshot.history).toEqual([]);
});
it('records a failed check for the estimate', () => {
    const access = gettingCertificate();

    access.authorityRefused('not-reachable', null, now);

    expect(access.snapshot.history).toEqual([
        { name: '82.66.118.204', at: now.toISOString(), kind: 'failed-check' },
    ]);
});
it('forgets the attempts older than 8 days when it records one', () => {
    const access = active();

    access.certificateIssued(false, now);
    access.certificateIssued(false, new Date('2026-11-16T10:00:00.000Z'));

    expect(access.snapshot.history.map((attempt) => attempt.at)).toEqual([
        '2026-11-16T10:00:00.000Z',
    ]);
});
it('keeps Let’s Encrypt’s date after a rate limit', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);

    expect(access.snapshot.retryAfter).toBe('2026-11-12T23:30:00.000Z');
});
it('waits 6 hours after a rate limit without a date', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', null, now);

    expect(access.snapshot.retryAfter).toBe('2026-11-08T16:00:00.000Z');
});
it('forgets Let’s Encrypt’s date once a certificate is issued', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', '2026-11-08T11:00:00.000Z', now);
    access.certificateIssued(false, new Date('2026-11-08T12:00:00.000Z'));

    expect(access.snapshot.retryAfter).toBeNull();
});
it('refuses an attempt before Let’s Encrypt’s date', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);

    const attempt = () => access.ensureAttemptAllowed(new Date('2026-11-12T23:29:59.000Z'));

    expect(attempt).toThrow(expect.objectContaining({ reason: 'rate-limited' }));
});
it('allows an attempt from Let’s Encrypt’s date', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);

    const allowed = access.attemptAllowed(new Date('2026-11-12T23:30:00.000Z'));

    expect(allowed).toBe(true);
});
it('keeps the attempts and Let’s Encrypt’s date through Turn off', () => {
    const access = active();

    access.certificateIssued(false, now);
    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);

    access.turnOff();

    expect([access.snapshot.history.length, access.snapshot.retryAfter]).toEqual([
        1,
        '2026-11-12T23:30:00.000Z',
    ]);
});
it('keeps the attempts and Let’s Encrypt’s date through a stopped setup and a new one', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);
    access.authorityRefused('not-reachable', null, now);
    access.stop('rate-limited', now);

    access.start(null, 34443);

    expect([access.snapshot.history.length, access.snapshot.retryAfter]).toEqual([
        1,
        '2026-11-12T23:30:00.000Z',
    ]);
});
it('waits for the Admin after a failed check while active', () => {
    const access = active();

    access.upkeepFailed('not-reachable', now);

    expect([
        access.snapshot.awaitingCheck,
        access.upkeepDue(new Date('2026-11-09T10:00:00.000Z')),
    ]).toEqual([true, false]);
});
it('waits for Let’s Encrypt’s date after a rate-limited upkeep', () => {
    const access = active();

    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);

    access.upkeepFailed('rate-limited', now);

    expect(access.snapshot.nextAttemptAt).toBe('2026-11-12T23:30:00.000Z');
});
it('keeps the growing delay after a failure that costs no attempt', () => {
    const access = active();

    access.upkeepFailed('authority-unavailable', now);

    expect([access.snapshot.awaitingCheck, access.snapshot.nextAttemptAt]).toEqual([
        false,
        '2026-11-08T11:00:00.000Z',
    ]);
});
it('checks again while active after a failed check, keeping the certificate', () => {
    const access = active();

    access.upkeepFailed('not-reachable', now);

    access.check();

    expect([access.phase, access.snapshot.step, access.certificate?.address]).toEqual([
        'active',
        'certificate',
        '82.66.118.204',
    ]);
});
it('has nothing to check while active without a failed check', () => {
    const access = active();

    const check = () => access.check();

    expect(check).toThrow(expect.objectContaining({ reason: 'nothing-to-check' }));
});
it('ends a check while active cut short by a restart, still waiting for the Admin', () => {
    const access = active();

    access.upkeepFailed('not-reachable', now);
    access.check();

    access.interrupted(now);

    expect([access.phase, access.snapshot.step, access.snapshot.awaitingCheck]).toEqual([
        'active',
        null,
        true,
    ]);
});
it('stops waiting for the Admin once a check works', () => {
    const access = active();

    access.upkeepFailed('not-reachable', now);
    access.check();

    access.upkeepSucceeded();

    expect([access.snapshot.step, access.snapshot.awaitingCheck]).toEqual([null, false]);
});
it('gives no estimate before a failure', () => {
    const access = active();

    const allowances = access.allowances(now);

    expect(allowances).toBeNull();
});
it('estimates what Let’s Encrypt still allows after a failure', () => {
    const access = active();

    access.certificateIssued(false, now);
    access.authorityRefused('not-reachable', null, now);
    access.upkeepFailed('not-reachable', now);

    const allowances = access.allowances(now);

    expect(allowances).toEqual({
        certificates: { left: 4, nextAt: null },
        checks: { left: 4, nextAt: null },
    });
});
it('estimates for the last address once internet access is off', () => {
    const access = gettingCertificate();

    access.authorityRefused('not-reachable', null, now);
    access.stop('not-reachable', now);

    const allowances = access.allowances(now);

    expect(allowances?.checks).toEqual({ left: 4, nextAt: null });
});
it('estimates for the address of a rate-limited setup once off', () => {
    const access = gettingCertificate();

    access.authorityRefused('rate-limited', '2026-11-12T23:30:00.000Z', now);
    access.stop('rate-limited', now);

    const allowances = access.allowances(now);

    expect(allowances?.certificates).toEqual({ left: 5, nextAt: null });
});
it('gives the HTTPS internet address with the router port while active', () => {
    const access = active();

    const result = access.origin;

    expect(result).toBe('https://82.66.118.204:34443');
});
it('leaves the port out of the HTTPS internet address when the router port is 443', () => {
    const access = new InternetAccess({ ...active().snapshot, routerPort: 443 });

    const result = access.origin;

    expect(result).toBe('https://82.66.118.204');
});
it('keeps the HTTPS port as the router port of a setup', () => {
    const access = InternetAccess.off();

    access.start(null, 34500);

    expect(access.routerPort).toBe(34500);
});
it('forgets the router port once off', () => {
    const access = active();

    access.turnOff();

    expect(access.routerPort).toBeNull();
});
it('refuses a saved setup without a router port', () => {
    const state = { ...active().snapshot, routerPort: null };

    const operation = () => new InternetAccess(state);

    expect(operation).toThrow('router port');
});
it('moves an active router rule to a new port and tells about the new address', () => {
    const access = active();

    access.ruleMoved(34500);

    expect([access.routerPort, access.origin, access.snapshot.addressMoved]).toEqual([
        34500,
        'https://82.66.118.204:34500',
        true,
    ]);
});
it('moves an awaited router rule without telling about a new address', () => {
    const access = gettingCertificate();

    access.certificateRefused('not-reachable', now);
    access.ruleMoved(34500);

    expect([access.routerPort, access.snapshot.addressMoved]).toEqual([34500, false]);
});
it('moves no router rule while off', () => {
    const access = InternetAccess.off();

    const operation = () => access.ruleMoved(34500);

    expect(operation).toThrow('router rule');
});
it('stops telling about the new address once the Admin has seen it', () => {
    const access = active();

    access.ruleMoved(34500);
    access.addressNoticeSeen();

    expect(access.snapshot.addressMoved).toBe(false);
});
it('gives the renewal date of an address certificate at half its lifetime', () => {
    const access = active();

    const result = access.renewalAt;

    expect(result?.toISOString()).toBe('2026-11-11T10:00:00.000Z');
});
it('gives the renewal date of a domain name certificate at two thirds of its lifetime', () => {
    const access = InternetAccess.off();

    access.start('home.example.fr', 34443);
    access.routerFound('upnp', '82.66.118.204', now);
    access.portOpened();
    access.activate({ ...certificate, address: 'home.example.fr' });

    const result = access.renewalAt;

    expect(result?.toISOString()).toBe('2026-11-12T10:00:00.000Z');
});
it('has no renewal date before it is active', () => {
    const access = gettingCertificate();

    const result = access.renewalAt;

    expect(result).toBeNull();
});
it('has no HTTPS internet address before it is active', () => {
    const access = gettingCertificate();

    const result = access.origin;

    expect(result).toBeNull();
});
