import { expect, it } from 'vitest';
import { OfflineInternetAccess } from './offline-internet-access.adapter.js';

it('finds no router', async () => {
    const { router } = OfflineInternetAccess.adapters();

    const connection = await router.find();

    expect(connection).toBeNull();
});
it('opens no router rule', async () => {
    const { router } = OfflineInternetAccess.adapters();

    const opened = await router.open({ externalPort: 443, internalPort: 3443 });

    expect(opened).toBe(false);
});
it('knows no public address', async () => {
    const { probe } = OfflineInternetAccess.adapters();

    const address = await probe.current();

    expect(address).toBeNull();
});
it('resolves no domain name', async () => {
    const { resolver } = OfflineInternetAccess.adapters();

    const addresses = await resolver.addresses('home.example.fr');

    expect(addresses).toEqual([]);
});
it('never issues a certificate', async () => {
    const { authority } = OfflineInternetAccess.adapters();

    const issue = await authority.issue({ kind: 'address', name: '82.66.118.204' });

    expect(issue).toEqual({ outcome: 'refused', reason: 'authority-unavailable' });
});
