import { expect, it } from 'vitest';
import { HttpInternetAccess } from './http-internet-access.entity.js';
import type { HttpInternetAccessState } from './http-internet-access.entity.js';

const now = new Date('2026-11-09T10:00:00.000Z');
const publicAddress = '82.66.118.204';

function open(): HttpInternetAccess {
    const access = HttpInternetAccess.off();

    access.opened('upnp', publicAddress);

    return access;
}

function openByHand(): HttpInternetAccess {
    const access = HttpInternetAccess.off();

    access.openedByHand(publicAddress, 'no-router', now);

    return access;
}

it('opens with the router rule and the public address', () => {
    const access = HttpInternetAccess.off();

    access.opened('upnp', publicAddress);

    expect(access.snapshot).toEqual({
        phase: 'open',
        mapping: 'upnp',
        publicAddress,
        failure: null,
        closedByHttps: false,
    });
});
it('opens by hand when the router does not answer', () => {
    const access = HttpInternetAccess.off();

    access.openedByHand(publicAddress, 'no-router', now);

    expect([access.phase, access.snapshot.mapping, access.snapshot.failure?.reason]).toEqual([
        'open',
        'manual',
        'no-router',
    ]);
});
it('refuses to open with a shared address', () => {
    const access = HttpInternetAccess.off();

    const operation = () => access.opened('upnp', '100.70.1.2');

    expect(operation).toThrow('needs a public address');
});
it('stays off with the reason opening could not work', () => {
    const access = HttpInternetAccess.off();

    access.refused('cgnat', now);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual(['off', 'cgnat']);
});
it('names a provider sharing the address', () => {
    const address = '100.70.1.2';

    const reason = HttpInternetAccess.blockedReason(address);

    expect(reason).toBe('cgnat');
});
it('names a router behind another router', () => {
    const address = '192.168.0.12';

    const reason = HttpInternetAccess.blockedReason(address);

    expect(reason).toBe('double-nat');
});
it('tells which addresses can receive connections from the internet', () => {
    const addresses = [publicAddress, '100.70.1.2', '10.0.0.1'];

    const usable = addresses.map((address) => HttpInternetAccess.usable(address));

    expect(usable).toEqual([true, false, false]);
});
it('removes its own router rule only', () => {
    const accesses = [open(), openByHand()];

    const automatic = accesses.map((access) => access.automatic);

    expect(automatic).toEqual([true, false]);
});
it('closes at the Admin request', () => {
    const access = open();

    access.close(false);

    expect(access.snapshot).toEqual(HttpInternetAccess.off().snapshot);
});
it('remembers that a working HTTPS closed it', () => {
    const access = open();

    access.close(true);

    expect([access.phase, access.snapshot.closedByHttps]).toEqual(['off', true]);
});
it('follows a new public address', () => {
    const access = open();

    access.addressChanged('82.66.118.77');

    expect(access.publicAddress).toBe('82.66.118.77');
});
it('keeps the rule after an upkeep failure', () => {
    const access = open();

    access.upkeepFailed('no-router', now);

    expect([access.phase, access.snapshot.failure?.reason]).toEqual(['open', 'no-router']);
});
it('clears the failure after a successful upkeep', () => {
    const access = open();

    access.upkeepFailed('no-router', now);

    access.upkeepSucceeded();

    expect(access.snapshot.failure).toBeNull();
});
it('keeps the reason of a rule by hand after a successful upkeep', () => {
    const access = openByHand();

    access.upkeepSucceeded();

    expect(access.snapshot.failure?.reason).toBe('no-router');
});
it('runs no upkeep while off', () => {
    const access = HttpInternetAccess.off();

    const operation = () => access.upkeepSucceeded();

    expect(operation).toThrow('not open');
});
it('refuses an open state without a public address', () => {
    const state: HttpInternetAccessState = {
        ...HttpInternetAccess.off().snapshot,
        phase: 'open',
        mapping: 'upnp',
    };

    const operation = () => new HttpInternetAccess(state);

    expect(operation).toThrow('needs a router rule and a public address');
});
it('opening again clears a previous closing by HTTPS', () => {
    const access = HttpInternetAccess.off();

    access.close(true);

    access.opened('upnp', publicAddress);

    expect(access.snapshot.closedByHttps).toBe(false);
});
it('gives the internet address of open access on the public address', () => {
    const access = open();

    const result = access.origin(null, 3000);

    expect(result).toBe('http://82.66.118.204:3000');
});
it('gives the internet address of open access on the domain name', () => {
    const access = open();

    const result = access.origin('library.example.org', 3000);

    expect(result).toBe('http://library.example.org:3000');
});
it('has no internet address while closed', () => {
    const access = HttpInternetAccess.off();

    const result = access.origin('library.example.org', 3000);

    expect(result).toBeNull();
});
