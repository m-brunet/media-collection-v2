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

    access.start(null);
    access.portNeeded(publicAddress, 'port-refused', new Date('2026-11-08T10:00:00.000Z'));

    return access.snapshot;
}

function subjectFor(doubles: ReturnType<typeof InternetAccessDoubles.setup>) {
    return new CheckInternetAccess(
        doubles.store,
        doubles.setup,
        doubles.background,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
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
