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
    return new ReadInternetAccess(
        doubles.store,
        doubles.tls,
        new FixedLocalAddress(),
        doubles.clock,
    );
}

it('gives the address phones open once active', async () => {
    const subject = subjectFor(InternetAccessDoubles.setup(InternetAccessDoubles.active()));

    const view = await subject.execute(admin);

    expect([view.origin, view.manualRule]).toEqual(['https://' + publicAddress, null]);
});
it('gives the values for a manual router rule while waiting for it', async () => {
    const access = InternetAccess.off();

    access.start(null);
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
it('gives the domain name as the address phones open', async () => {
    const state = InternetAccessDoubles.active({
        domain: 'home.example.fr',
        certificate: {
            address: 'home.example.fr',
            issuedAt: '2026-11-08T10:00:00.000Z',
            expiresAt: '2027-02-06T10:00:00.000Z',
        },
    });
    const subject = subjectFor(InternetAccessDoubles.setup(state));

    const view = await subject.execute(admin);

    expect([view.origin, view.domain]).toEqual(['https://home.example.fr', 'home.example.fr']);
});
it('gives what Let’s Encrypt probably still allows after a failure', async () => {
    const subject = subjectFor(
        InternetAccessDoubles.setup(
            InternetAccessDoubles.active({
                failure: { reason: 'not-reachable', at: '2026-11-08T09:59:00.000Z' },
                history: [
                    { name: publicAddress, at: '2026-11-08T09:59:00.000Z', kind: 'failed-check' },
                ],
            }),
        ),
    );

    const view = await subject.execute(admin);

    expect(view.allowances).toEqual({
        certificates: { left: 5, nextAt: null },
        checks: { left: 4, nextAt: null },
    });
});
it('keeps the attempt history on the server', async () => {
    const subject = subjectFor(
        InternetAccessDoubles.setup(
            InternetAccessDoubles.active({
                history: [
                    { name: publicAddress, at: '2026-11-08T09:59:00.000Z', kind: 'certificate' },
                ],
            }),
        ),
    );

    const view = await subject.execute(admin);

    expect('history' in view).toBe(false);
});
it('gives Let’s Encrypt’s date while it is ahead', async () => {
    const subject = subjectFor(
        InternetAccessDoubles.setup({
            ...InternetAccess.off().snapshot,
            retryAfter: '2026-11-08T10:00:01.000Z',
        }),
    );

    const view = await subject.execute(admin);

    expect(view.retryAfter).toBe('2026-11-08T10:00:01.000Z');
});
it('gives no date once Let’s Encrypt’s date has passed', async () => {
    const subject = subjectFor(
        InternetAccessDoubles.setup({
            ...InternetAccess.off().snapshot,
            retryAfter: '2026-11-08T10:00:00.000Z',
        }),
    );

    const view = await subject.execute(admin);

    expect(view.retryAfter).toBeNull();
});
