import { expect, it } from 'vitest';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { FakeResolver, publicAddress } from '../testing/internet-access-doubles.test-support.js';
import { DomainNameCheck } from './domain-name-check.service.js';

function accessFor(domain: string | null): InternetAccess {
    const access = InternetAccess.off();

    access.start(domain);
    access.routerFound('upnp', publicAddress, new Date('2026-11-08T10:00:00.000Z'));

    return access;
}

it('has nothing to check without a domain name', async () => {
    const resolver = new FakeResolver([]);
    const check = new DomainNameCheck(resolver);

    const problem = await check.problem(accessFor(null));

    expect([problem, resolver.asked]).toEqual([null, []]);
});
it('accepts a domain name that points to the public address', async () => {
    const check = new DomainNameCheck(new FakeResolver(['82.66.1.1', publicAddress]));

    const problem = await check.problem(accessFor('home.example.fr'));

    expect(problem).toBeNull();
});
it('looks up the domain name', async () => {
    const resolver = new FakeResolver([publicAddress]);
    const check = new DomainNameCheck(resolver);

    await check.problem(accessFor('home.example.fr'));

    expect(resolver.asked).toEqual(['home.example.fr']);
});
it('reports a domain name without an address', async () => {
    const check = new DomainNameCheck(new FakeResolver([]));

    const problem = await check.problem(accessFor('home.example.fr'));

    expect(problem).toBe('domain-unresolved');
});
it('reports a domain name that points elsewhere', async () => {
    const check = new DomainNameCheck(new FakeResolver(['82.66.118.77']));

    const problem = await check.problem(accessFor('home.example.fr'));

    expect(problem).toBe('domain-mismatch');
});
