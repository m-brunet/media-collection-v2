import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import {
    InternetAccessDoubles,
    MemoryHttpInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';
import { CloseHttpInternetAccess } from './close-http-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');

function subjectFor(
    doubles: ReturnType<typeof InternetAccessDoubles.setup>,
    store = new MemoryHttpInternetAccessStore(InternetAccessDoubles.httpOpen()),
    trail = new MemoryAuditTrail(),
) {
    return {
        store,
        subject: new CloseHttpInternetAccess(
            store,
            doubles.forwarding,
            AuditDoubles.auditedOperation(trail),
        ),
    };
}

it('closes HTTP to the internet and removes the router rule', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject, store } = subjectFor(doubles);

    const state = await subject.execute(admin);

    expect([state.phase, store.current.closedByHttps, doubles.router.closed]).toEqual([
        'off',
        false,
        [{ externalPort: 34345, internalPort: 34345 }],
    ]);
});
it('refuses an Owner', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles);

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('records the closing in the technical audit log', async () => {
    const doubles = InternetAccessDoubles.setup();
    const trail = new MemoryAuditTrail();
    const { subject } = subjectFor(doubles, undefined, trail);

    await subject.execute(admin);

    expect(trail.entries.map((entry) => [entry.category, entry.outcome])).toEqual([
        ['server-settings.http-internet-access-closed', 'successful'],
    ]);
});
