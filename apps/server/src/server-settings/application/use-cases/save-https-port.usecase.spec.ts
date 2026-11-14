import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { actor, SettingsDoubles } from '../testing/settings-doubles.test-support.js';
import { SaveHttpsPort } from './save-https-port.usecase.js';

function subjectFor(
    doubles: ReturnType<typeof SettingsDoubles.setup>,
    trail = new MemoryAuditTrail(),
) {
    return new SaveHttpsPort(doubles.store, doubles.http, AuditDoubles.auditedOperation(trail));
}

it('saves the HTTPS port and keeps the certificate settings', async () => {
    const doubles = SettingsDoubles.setup({ enabled: true, port: 3443, hasCertificate: true });
    const subject = subjectFor(doubles);

    const result = await subject.execute(actor, { port: 34443 });

    expect([result, await doubles.store.read()]).toEqual([
        { enabled: true, port: 34443, hasCertificate: true },
        { enabled: true, port: 34443, hasCertificate: true },
    ]);
});
it('refuses the HTTP port', async () => {
    const doubles = SettingsDoubles.setup(undefined, { port: 34345 });
    const subject = subjectFor(doubles);

    const result = subject.execute(actor, { port: 34345 });

    await expect(result).rejects.toMatchObject({ reason: 'ports-identical' });
});
it('refuses a port under 1024', async () => {
    const doubles = SettingsDoubles.setup();
    const subject = subjectFor(doubles);

    const result = subject.execute(actor, { port: 443 });

    await expect(result).rejects.toThrow('between 1024 and 65535');
});
it('records the change in the technical audit log', async () => {
    const trail = new MemoryAuditTrail();
    const subject = subjectFor(SettingsDoubles.setup(), trail);

    await subject.execute(actor, { port: 34443 });

    expect(trail.entries.map((entry) => [entry.category, entry.outcome])).toEqual([
        ['server-settings.https-port-changed', 'successful'],
    ]);
});
it('refuses a non-administrator', async () => {
    const subject = subjectFor(SettingsDoubles.setup());

    const result = subject.execute({ ...actor, role: 'owner' as const }, { port: 34443 });

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
