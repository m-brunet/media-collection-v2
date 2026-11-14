import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { InternetAccessDoubles } from '../testing/internet-access-doubles.test-support.js';
import { TurnOffInternetAccess } from './turn-off-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');

function subjectFor(
    doubles: ReturnType<typeof InternetAccessDoubles.setup>,
    trail = new MemoryAuditTrail(),
) {
    return new TurnOffInternetAccess(
        doubles.store,
        doubles.router,
        AuditDoubles.auditedOperation(trail),
    );
}

it('turns internet access off', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute(admin);

    expect(doubles.store.current).toEqual(InternetAccess.off().snapshot);
});
it('removes the router rule it created', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute(admin);

    expect(doubles.router.closed).toEqual([{ externalPort: 3443, internalPort: 3443 }]);
});
it('leaves a rule the Admin created by hand to the Admin', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ mapping: 'manual' }),
    );
    const subject = subjectFor(doubles);

    await subject.execute(admin);

    expect(doubles.router.closed).toEqual([]);
});
it('records the change in the technical audit log', async () => {
    const trail = new MemoryAuditTrail();
    const subject = subjectFor(InternetAccessDoubles.setup(InternetAccessDoubles.active()), trail);

    await subject.execute(admin);

    expect(trail.entries.map((entry) => [entry.category, entry.outcome])).toEqual([
        ['server-settings.internet-access-turned-off', 'successful'],
    ]);
});
it('waits for a running setup to finish', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ phase: 'setting-up', step: 'port' }),
    );
    const subject = subjectFor(doubles);

    const result = subject.execute(admin);

    await expect(result).rejects.toMatchObject({ reason: 'setup-in-progress' });
});
it('refuses an Owner', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
