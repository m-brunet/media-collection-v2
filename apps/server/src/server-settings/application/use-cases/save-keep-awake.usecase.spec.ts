import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { MemoryKeepAwake } from '../testing/internet-access-doubles.test-support.js';
import { SaveKeepAwake } from './save-keep-awake.usecase.js';

const admin = TestActors.of('admin', 'admin');

it('saves the setting', async () => {
    const keepAwake = new MemoryKeepAwake();
    const subject = new SaveKeepAwake(
        keepAwake,
        keepAwake,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    await subject.execute(admin, { enabled: true });

    expect(await keepAwake.read()).toBe(true);
});
it('applies the setting to the desktop host at once', async () => {
    const keepAwake = new MemoryKeepAwake();
    const subject = new SaveKeepAwake(
        keepAwake,
        keepAwake,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    await subject.execute(admin, { enabled: true });

    expect(keepAwake.applied).toEqual([true]);
});
it('records the change in the technical audit log', async () => {
    const keepAwake = new MemoryKeepAwake();
    const trail = new MemoryAuditTrail();
    const subject = new SaveKeepAwake(keepAwake, keepAwake, AuditDoubles.auditedOperation(trail));

    await subject.execute(admin, { enabled: true });

    expect(trail.entries.map((entry) => [entry.category, entry.before, entry.after])).toEqual([
        ['server-settings.keep-awake-changed', { enabled: false }, { enabled: true }],
    ]);
});
it('refuses an Owner without applying anything', async () => {
    const keepAwake = new MemoryKeepAwake();
    const subject = new SaveKeepAwake(
        keepAwake,
        keepAwake,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    const result = subject.execute(TestActors.of('owner', 'olivia'), { enabled: true });

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    expect(keepAwake.applied).toEqual([]);
});
