import { expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { HttpInternetAccess } from '../../domain/entities/http-internet-access.entity.js';
import {
    FixedHttpSettings,
    FixedLocalAddress,
    InternetAccessDoubles,
    MemoryDomainNameStore,
    MemoryHttpInternetAccessStore,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { ReadHttpInternetAccess } from './read-http-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');

function subjectFor(state = InternetAccessDoubles.httpOpen(), domain: string | null = null) {
    return new ReadHttpInternetAccess(
        new MemoryHttpInternetAccessStore(state),
        new MemoryDomainNameStore(domain),
        new FixedHttpSettings(),
        new FixedLocalAddress(),
    );
}

it('gives the HTTP address on the public address', async () => {
    const subject = subjectFor();

    const view = await subject.execute(admin);

    expect([view.origin, view.manualRule]).toEqual(['http://' + publicAddress + ':34345', null]);
});
it('gives the HTTP address on the domain name', async () => {
    const subject = subjectFor(undefined, 'home.example.fr');

    const view = await subject.execute(admin);

    expect(view.origin).toBe('http://home.example.fr:34345');
});
it('gives the values of a rule to add by hand', async () => {
    const access = HttpInternetAccess.off();

    access.openedByHand(publicAddress, 'port-refused', new Date('2026-11-09T10:00:00.000Z'));
    const subject = subjectFor(access.snapshot);

    const view = await subject.execute(admin);

    expect(view.manualRule).toEqual({
        localAddress: '192.168.1.99',
        internalPort: 34345,
        externalPort: 34345,
        protocol: 'TCP',
    });
});
it('gives no address while closed', async () => {
    const subject = subjectFor(HttpInternetAccess.off().snapshot);

    const view = await subject.execute(admin);

    expect([view.phase, view.origin, view.manualRule]).toEqual(['off', null, null]);
});
it('refuses an Owner', async () => {
    const subject = subjectFor();

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
