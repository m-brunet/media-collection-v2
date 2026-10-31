import { expect, it } from 'vitest';
import { SaveHttpSettings } from './save-http-settings.usecase.js';
import { actor, setup } from '../testing/settings-doubles.test-support.js';

it('saves the selected HTTP port without changing HTTPS', async () => {
    const { http, store } = setup();
    const subject = new SaveHttpSettings(http, store);
    const input = { port: 36000 };

    const result = await subject.execute(actor, input);

    expect(result).toEqual(input);
    expect((await http.read()).snapshot()).toEqual(input);
    expect(await store.read()).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});

it('rejects a privileged HTTP port without changing storage', async () => {
    const { http, store } = setup();
    const subject = new SaveHttpSettings(http, store);
    const input = { port: 1023 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await http.read()).snapshot()).toEqual({ port: 3000 });
});

it('rejects an HTTP port above the maximum without changing storage', async () => {
    const { http, store } = setup();
    const subject = new SaveHttpSettings(http, store);
    const input = { port: 65536 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    expect((await http.read()).snapshot()).toEqual({ port: 3000 });
});

it('rejects HTTP port collisions with enabled HTTPS', async () => {
    const { http, store } = setup({ enabled: true, port: 36000, hasCertificate: true });
    const subject = new SaveHttpSettings(http, store);
    const input = { port: 36000 };

    const result = subject.execute(actor, input);

    await expect(result).rejects.toThrow('different ports');
    expect((await http.read()).snapshot()).toEqual({ port: 3000 });
});

it('allows the saved HTTPS port when HTTPS is disabled', async () => {
    const { http, store } = setup();
    const subject = new SaveHttpSettings(http, store);
    const input = { port: 3443 };

    const result = await subject.execute(actor, input);

    expect(result).toEqual(input);
    expect((await http.read()).snapshot()).toEqual(input);
});

it('rejects a non-administrator saving HTTP settings', async () => {
    const { http, store } = setup();
    const subject = new SaveHttpSettings(http, store);
    const forbidden = { ...actor, role: 'user' as const };
    const input = { port: 36000 };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    expect((await http.read()).snapshot()).toEqual({ port: 3000 });
});

it('rejects HTTP settings changes before password setup', async () => {
    const { http, store } = setup();
    const subject = new SaveHttpSettings(http, store);
    const forbidden = { ...actor, mustChangePassword: true };
    const input = { port: 36000 };

    const result = subject.execute(forbidden, input);

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    expect((await http.read()).snapshot()).toEqual({ port: 3000 });
});
