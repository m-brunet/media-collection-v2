import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { expect, it } from 'vitest';
import { SaveTlsSettings } from './save-tls-settings.usecase.js';
import { actor, SettingsDoubles } from '../testing/settings-doubles.test-support.js';
import {
    InternetAccessDoubles,
    MemoryInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';

it('validates and saves supplied material', async () => {
    const { store, validator, http, validations, internetAccess } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { enabled: true, chain: 'certificate', key: 'private' };

    const result = await subject.execute(actor, input);

    expect(result).toEqual({ enabled: true, port: 3443, hasCertificate: true });
    expect(await store.read()).toEqual(result);
    expect(validations()).toBe(1);
});
it('retains saved material when fields are omitted', async () => {
    const { store, validator, http, validations, internetAccess } = SettingsDoubles.setup({
        enabled: true,
        port: 3443,
        hasCertificate: true,
    });
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { enabled: false };

    const result = await subject.execute(actor, input);

    expect(result).toEqual({ enabled: false, port: 3443, hasCertificate: true });
    expect(validations()).toBe(0);
});
it('rejects enabling TLS without a certificate', async () => {
    const input = { enabled: true };
    const { store, validator, http, internetAccess } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects an incomplete certificate pair', async () => {
    const input = { enabled: true, chain: 'certificate' };
    const { store, validator, http, internetAccess } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects an invalid certificate pair', async () => {
    const input = { enabled: true, chain: 'wrong', key: 'private' };
    const { store, validator, http, internetAccess } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects a non-administrator', async () => {
    const forbidden = { ...actor, role: 'owner' as const };
    const { store, validator, http, internetAccess } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { enabled: false };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('rejects incomplete password setup', async () => {
    const forbidden = { ...actor, mustChangePassword: true };
    const { store, validator, http, internetAccess } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { enabled: false };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('rejects an enabled HTTPS port matching saved HTTP', async () => {
    const { store, validator, http, internetAccess } = SettingsDoubles.setup(
        { enabled: false, port: 36000, hasCertificate: true },
        { port: 36000 },
    );
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        internetAccess,
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { enabled: true };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow('different ports');
    expect(await store.read()).toEqual({ enabled: false, port: 36000, hasCertificate: true });
});
it('refuses any HTTPS change while internet access is on', async () => {
    const { store, validator, http } = SettingsDoubles.setup();
    const subject = new SaveTlsSettings(
        store,
        validator,
        http,
        new MemoryInternetAccessStore(InternetAccessDoubles.active()),
        AuditDoubles.auditedOperation(new MemoryAuditTrail()),
    );
    const input = { enabled: true, chain: 'certificate', key: 'private' };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toMatchObject({ code: 'conflict', reason: 'internet-access-on' });
});
