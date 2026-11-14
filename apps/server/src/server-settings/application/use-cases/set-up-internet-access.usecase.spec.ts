import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import type { TlsSettingsState } from '../../domain/value-objects/tls-settings.value-object.js';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { SetUpInternetAccess } from './set-up-internet-access.usecase.js';

const admin = TestActors.of('admin', 'admin');
const manualCertificate: TlsSettingsState = { enabled: true, port: 3443, hasCertificate: true };

function subjectFor(
    doubles: ReturnType<typeof InternetAccessDoubles.setup>,
    trail = new MemoryAuditTrail(),
) {
    return new SetUpInternetAccess(
        doubles.store,
        doubles.tls,
        doubles.names,
        doubles.setup,
        doubles.background,
        AuditDoubles.auditedOperation(trail),
        doubles.clock,
    );
}

it('answers at once with the setup looking for the router', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin, { replaceCertificate: false });

    expect([state.phase, state.step]).toEqual(['setting-up', 'router']);
});
it('uses the saved HTTPS port as the port outside', async () => {
    const doubles = InternetAccessDoubles.setup(undefined, {
        enabled: false,
        port: 34500,
        hasCertificate: false,
    });
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin, { replaceCertificate: false });

    expect(state.routerPort).toBe(34500);
});
it('uses the running HTTPS port while a saved one waits for the restart', async () => {
    const doubles = InternetAccessDoubles.setup(undefined, {
        enabled: false,
        port: 34500,
        hasCertificate: false,
    });
    const subject = subjectFor(doubles);

    doubles.https.running = 34443;

    const state = await subject.execute(admin, { replaceCertificate: false });

    expect(state.routerPort).toBe(34443);
});
it('runs the setup steps in the background', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    await subject.execute(admin, { replaceCertificate: false });

    await doubles.background.settled();

    expect([doubles.store.current.phase, doubles.store.current.publicAddress]).toEqual([
        'active',
        publicAddress,
    ]);
});
it('records the Admin’s request in the technical audit log', async () => {
    const trail = new MemoryAuditTrail();
    const subject = subjectFor(InternetAccessDoubles.setup(), trail);

    await subject.execute(admin, { replaceCertificate: false });

    expect(trail.entries.map((entry) => [entry.category, entry.outcome])).toEqual([
        ['server-settings.internet-access-set-up', 'successful'],
    ]);
});
it('refuses an Owner', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const result = subject.execute(TestActors.of('owner', 'olivia'), { replaceCertificate: false });

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('asks for confirmation before replacing a manual certificate', async () => {
    const doubles = InternetAccessDoubles.setup(undefined, manualCertificate);
    const subject = subjectFor(doubles);

    const result = subject.execute(admin, { replaceCertificate: false });

    await expect(result).rejects.toMatchObject({
        code: 'conflict',
        reason: 'certificate-replacement-unconfirmed',
    });
});
it('starts over a manual certificate once confirmed', async () => {
    const doubles = InternetAccessDoubles.setup(undefined, manualCertificate);
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin, { replaceCertificate: true });

    expect(state.phase).toBe('setting-up');
});
it('sets up again over its own certificate without confirmation', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active(), manualCertificate);
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin, { replaceCertificate: false });

    expect(state.phase).toBe('setting-up');
});
it('refuses a second setup while one runs', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    await subject.execute(admin, { replaceCertificate: false });

    const result = subject.execute(admin, { replaceCertificate: false });

    await expect(result).rejects.toMatchObject({ reason: 'setup-in-progress' });
});
it('sets up internet access for the saved domain name', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    doubles.names.name = 'home.example.fr';

    const state = await subject.execute(admin, { replaceCertificate: false });

    expect([state.phase, state.domain]).toEqual(['setting-up', 'home.example.fr']);
});
it('refuses a setup before Let’s Encrypt’s date', async () => {
    const doubles = InternetAccessDoubles.setup({
        ...InternetAccess.off().snapshot,
        retryAfter: '2026-11-12T23:30:00.000Z',
    });
    const subject = subjectFor(doubles);

    const result = subject.execute(admin, { replaceCertificate: false });

    await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'rate-limited' });
});
it('sets up again from Let’s Encrypt’s date', async () => {
    const doubles = InternetAccessDoubles.setup({
        ...InternetAccess.off().snapshot,
        retryAfter: '2026-11-08T10:00:00.000Z',
    });
    const subject = subjectFor(doubles);

    const state = await subject.execute(admin, { replaceCertificate: false });

    expect(state.phase).toBe('setting-up');
});
