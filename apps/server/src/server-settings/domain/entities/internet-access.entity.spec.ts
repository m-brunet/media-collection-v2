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

    access.start(null);

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

    access.start(null);

    expect([access.phase, access.snapshot.step]).toEqual(['setting-up', 'router']);
});
it('refuses a second setup while one runs', () => {
    const access = settingUp();

    const operation = () => access.start(null);

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

    access.start(null);

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

    access.start('Home.Example.fr');
    access.routerFound('upnp', '82.66.118.204', now);
    access.portOpened();
    access.activate(domainCertificate);

    return access;
}

it('starts a setup with the domain name', () => {
    const access = InternetAccess.off();

    access.start(' Home.Example.FR ');

    expect([access.phase, access.domain]).toEqual(['setting-up', 'home.example.fr']);
});
it('starts a setup without a domain name when the field is blank', () => {
    const access = InternetAccess.off();

    access.start('');

    expect(access.domain).toBeNull();
});
it('refuses an invalid domain name', () => {
    const access = InternetAccess.off();

    const operation = () => access.start('https://home.example.fr');

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

    access.start('home.example.fr');
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

    access.start('home.example.fr');

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
