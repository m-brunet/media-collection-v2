import { expect, it } from 'vitest';
import { DnsDomainNameResolver } from './dns-domain-name-resolver.adapter.js';

it('answers the IPv4 addresses of the name', async () => {
    const resolver = new DnsDomainNameResolver(async (name) =>
        name === 'home.example.fr' ? ['82.66.118.204'] : [],
    );

    const addresses = await resolver.addresses('home.example.fr');

    expect(addresses).toEqual(['82.66.118.204']);
});
it('answers no address for an unknown name', async () => {
    const resolver = new DnsDomainNameResolver(async () => {
        throw Object.assign(new Error('queryA ENOTFOUND home.example.fr'), { code: 'ENOTFOUND' });
    });

    const addresses = await resolver.addresses('home.example.fr');

    expect(addresses).toEqual([]);
});
it('answers no address when the DNS servers do not answer', async () => {
    const resolver = new DnsDomainNameResolver(async () => {
        throw Object.assign(new Error('queryA ETIMEOUT home.example.fr'), { code: 'ETIMEOUT' });
    });

    const addresses = await resolver.addresses('home.example.fr');

    expect(addresses).toEqual([]);
});
