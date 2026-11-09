import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { expect, it } from 'vitest';
import { SaveHttpSettings } from './save-http-settings.usecase.js';
import { actor, SettingsDoubles } from '../testing/settings-doubles.test-support.js';
import {
    InternetAccessDoubles,
    MemoryHttpInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';

it('saves the selected HTTP port without changing HTTPS', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { port: 36000 };

    const result = await subject.execute(actor, input);

    expect(result).toEqual(input);
    expect((await http.read()).snapshot()).toEqual(input);
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});

it('rejects a privileged HTTP port without changing storage', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { port: 1023 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await http.read()).snapshot()).toEqual({ port: 34345 });
});

it('rejects an HTTP port above the maximum without changing storage', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { port: 65536 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await http.read()).snapshot()).toEqual({ port: 34345 });
});

it('rejects HTTP port collisions with enabled HTTPS', async () => {
    const { http, store } = SettingsDoubles.setup({
        enabled: true,
        port: 36000,
        hasCertificate: true,
    });
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { port: 36000 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow('different ports');
    expect((await http.read()).snapshot()).toEqual({ port: 34345 });
});

it('allows the saved HTTPS port when HTTPS is disabled', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { port: 3443 };

    const result = await subject.execute(actor, input);

    expect(result).toEqual(input);
    expect((await http.read()).snapshot()).toEqual(input);
});

it('rejects a non-administrator saving HTTP settings', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const forbidden = { ...actor, role: 'owner' as const };
    const input = { port: 36000 };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    expect((await http.read()).snapshot()).toEqual({ port: 34345 });
});

it('rejects HTTP settings changes before password setup', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const forbidden = { ...actor, mustChangePassword: true };
    const input = { port: 36000 };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    expect((await http.read()).snapshot()).toEqual({ port: 34345 });
});

it('refuses another HTTP port while HTTP is open to the internet', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(InternetAccessDoubles.httpOpen()),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    const result = subject.execute(actor, { port: 36000 });

    await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'internet-access-on' });
    expect((await http.read()).snapshot()).toEqual({ port: 34345 });
});
it('saves the same HTTP port while HTTP is open to the internet', async () => {
    const { http, store } = SettingsDoubles.setup();
    const subject = new SaveHttpSettings(
        http,
        store,
        new MemoryHttpInternetAccessStore(InternetAccessDoubles.httpOpen()),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    const result = await subject.execute(actor, { port: 34345 });

    expect(result).toEqual({ port: 34345 });
});
