import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { CheckInternetAccess } from './check-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');

function waitingForPort() {
    const access = InternetAccess.off();

    access.start(null, 3443);
    access.portNeeded(publicAddress, 'port-refused', new Date('2026-11-08T10:00:00.000Z'));

    return access.snapshot;
}

function subjectFor(doubles: ReturnType<typeof InternetAccessDoubles.setup>) {
    return new CheckInternetAccess(
        doubles.store,
        doubles.setup,
        doubles.background,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        doubles.clock,
    );
}

it('answers at once with the certificate step', async () => {
    const doubles = InternetAccessDoubles.setup(waitingForPort());
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin);

    expect([state.phase, state.step]).toEqual(['setting-up', 'certificate']);
});
it('activates internet access once the manual rule works', async () => {
    const doubles = InternetAccessDoubles.setup(waitingForPort());
    const subject = subjectFor(doubles);

    await subject.execute(admin);

    await doubles.background.settled();

    expect(doubles.store.current.phase).toBe('active');
});
it('has nothing to check while internet access is off', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const result = subject.execute(admin);

    await expect(result).rejects.toMatchObject({ reason: 'nothing-to-check' });
});
it('refuses a Guest', async () => {
    const doubles = InternetAccessDoubles.setup(waitingForPort());
    const subject = subjectFor(doubles);

    const result = subject.execute(TestActors.of('guest', 'gus'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('checks again while active after a failed check, keeping the certificate in use', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'not-reachable', at: '2026-11-08T10:00:00.000Z' },
            awaitingCheck: true,
        }),
    );
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin);

    expect([state.phase, state.step, state.certificate?.address]).toEqual([
        'active',
        'certificate',
        publicAddress,
    ]);
});
it('replaces the certificate once the check while active works', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'not-reachable', at: '2026-11-08T10:00:00.000Z' },
            awaitingCheck: true,
        }),
    );
    const subject = subjectFor(doubles);

    doubles.clock.time = new Date('2026-11-09T10:00:00.000Z');

    await subject.execute(admin);

    await doubles.background.settled();

    expect([
        doubles.store.current.phase,
        doubles.store.current.certificate?.issuedAt,
        doubles.store.current.awaitingCheck,
    ]).toEqual(['active', '2026-11-09T10:00:00.000Z', false]);
});
it('keeps internet access on when the check while active fails again', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({
            failure: { reason: 'not-reachable', at: '2026-11-08T10:00:00.000Z' },
            awaitingCheck: true,
        }),
    );
    const subject = subjectFor(doubles);

    doubles.authority.refusal = 'not-reachable';

    await subject.execute(admin);

    await doubles.background.settled();

    expect([
        doubles.store.current.phase,
        doubles.store.current.step,
        doubles.store.current.awaitingCheck,
        doubles.store.current.certificate?.issuedAt,
    ]).toEqual(['active', null, true, '2026-11-08T10:00:00.000Z']);
});
it('refuses a check before Let’s Encrypt’s date', async () => {
    const doubles = InternetAccessDoubles.setup({
        ...waitingForPort(),
        retryAfter: '2026-11-12T23:30:00.000Z',
    });
    const subject = subjectFor(doubles);

    const result = subject.execute(admin);

    await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'rate-limited' });
});
