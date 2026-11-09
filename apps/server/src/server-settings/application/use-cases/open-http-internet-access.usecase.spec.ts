import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { InternetAccessDoubles } from '../testing/internet-access-doubles.test-support.js';
import { OpenHttpInternetAccess } from './open-http-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');

function subjectFor(
    doubles: ReturnType<typeof InternetAccessDoubles.setup>,
    trail = new MemoryAuditTrail(),
) {
    return new OpenHttpInternetAccess(
        doubles.http,
        doubles.store,
        doubles.forwarding,
        AuditDoubles.auditedOperation(trail),
    );
}

it('opens HTTP to the internet', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin);

    expect([state.phase, doubles.http.current.phase]).toEqual(['open', 'open']);
});
it('refuses while HTTPS works from the internet', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    const result = subject.execute(admin);

    await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'https-active' });
    expect(doubles.router.opened).toEqual([]);
});
it('refuses an Owner', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('records the opening in the technical audit log', async () => {
    const doubles = InternetAccessDoubles.setup();
    const trail = new MemoryAuditTrail();
    const subject = subjectFor(doubles, trail);

    await subject.execute(admin);

    expect(trail.entries.map((entry) => [entry.category, entry.outcome])).toEqual([
        ['server-settings.http-internet-access-opened', 'successful'],
    ]);
});
