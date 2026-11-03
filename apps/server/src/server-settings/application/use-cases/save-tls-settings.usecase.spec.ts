import { expect, it } from 'vitest';
import { SaveTlsSettings } from './save-tls-settings.usecase.js';
import { actor, setup } from '../testing/settings-doubles.test-support.js';

it('validates and saves supplied material', async () => {
    const { store, validator, http, validations } = setup();
    const subject = new SaveTlsSettings(store, validator, http);
    const input = { enabled: true, port: 3443, chain: 'certificate', key: 'private' };

    const result = await subject.execute(actor, input);

    expect(result).toEqual({ enabled: true, port: 3443, hasCertificate: true });
    expect(await store.read()).toEqual(result);
    expect(validations()).toBe(1);
});
it('retains saved material when fields are omitted', async () => {
    const { store, validator, http, validations } = setup({
        enabled: true,
        port: 3443,
        hasCertificate: true,
    });
    const subject = new SaveTlsSettings(store, validator, http);
    const input = { enabled: false, port: 4000 };

    const result = await subject.execute(actor, input);

    expect(result).toEqual({ enabled: false, port: 4000, hasCertificate: true });
    expect(validations()).toBe(0);
});
it('rejects enabling TLS without a certificate', async () => {
    const input = { enabled: true, port: 3443 };
    const { store, validator, http } = setup();
    const subject = new SaveTlsSettings(store, validator, http);

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects an incomplete certificate pair', async () => {
    const input = { enabled: true, port: 3443, chain: 'certificate' };
    const { store, validator, http } = setup();
    const subject = new SaveTlsSettings(store, validator, http);

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects an invalid certificate pair', async () => {
    const input = { enabled: true, port: 3443, chain: 'wrong', key: 'private' };
    const { store, validator, http } = setup();
    const subject = new SaveTlsSettings(store, validator, http);

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects port zero', async () => {
    const input = { enabled: false, port: 0 };
    const { store, validator, http } = setup();
    const subject = new SaveTlsSettings(store, validator, http);

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow();
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects a non-administrator', async () => {
    const forbidden = { ...actor, role: 'user' as const };
    const { store, validator, http } = setup();
    const subject = new SaveTlsSettings(store, validator, http);
    const input = { enabled: false, port: 3443 };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('rejects incomplete password setup', async () => {
    const forbidden = { ...actor, mustChangePassword: true };
    const { store, validator, http } = setup();
    const subject = new SaveTlsSettings(store, validator, http);
    const input = { enabled: false, port: 3443 };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('rejects an enabled HTTPS port matching saved HTTP', async () => {
    const { store, validator, http } = setup(
        { enabled: false, port: 3443, hasCertificate: true },
        { port: 36000 },
    );
    const subject = new SaveTlsSettings(store, validator, http);
    const input = { enabled: true, port: 36000 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow('different ports');
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: true });
});
it('allows matching saved ports when HTTPS is disabled', async () => {
    const { store, validator, http } = setup(undefined, { port: 36000 });
    const subject = new SaveTlsSettings(store, validator, http);
    const input = { enabled: false, port: 36000 };

    const result = await subject.execute(actor, input);

    expect(result).toEqual({ ...input, hasCertificate: false });
});
