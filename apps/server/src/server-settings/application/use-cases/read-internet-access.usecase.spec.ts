import { expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import {
    FixedLocalAddress,
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { ReadInternetAccess } from './read-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');

function subjectFor(doubles: ReturnType<typeof InternetAccessDoubles.setup>) {
    return new ReadInternetAccess(doubles.store, doubles.tls, new FixedLocalAddress());
}

it('gives the address phones open once active', async () => {
    const subject = subjectFor(InternetAccessDoubles.setup(InternetAccessDoubles.active()));

    const view = await subject.execute(admin);

    expect([view.origin, view.manualRule]).toEqual(['https://' + publicAddress, null]);
});
it('gives the values for a manual router rule while waiting for it', async () => {
    const access = InternetAccess.off();

    access.start();
    access.portNeeded(publicAddress, 'no-router', new Date('2026-11-08T10:00:00.000Z'));
    const subject = subjectFor(InternetAccessDoubles.setup(access.snapshot));

    const view = await subject.execute(admin);

    expect([view.origin, view.manualRule]).toEqual([
        null,
        { localAddress: '192.168.1.99', internalPort: 3443, externalPort: 443, protocol: 'TCP' },
    ]);
});
it('shows nothing to open while off', async () => {
    const subject = subjectFor(InternetAccessDoubles.setup());

    const view = await subject.execute(admin);

    expect([view.phase, view.origin, view.manualRule]).toEqual(['off', null, null]);
});
it('refuses an Owner', async () => {
    const subject = subjectFor(InternetAccessDoubles.setup());

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
