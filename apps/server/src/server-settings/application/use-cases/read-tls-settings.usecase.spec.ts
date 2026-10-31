import { expect, it } from 'vitest';
import { ReadTlsSettings } from './read-tls-settings.usecase.js';
import { actor, setup } from '../testing/settings-doubles.test-support.js';

it('reads configured settings', async () => {
    const { store } = setup();
    const subject = new ReadTlsSettings(store);

    const result = await subject.execute(actor);

    expect(result).toEqual({ enabled: false, port: 3443, hasCertificate: false });
});
it('rejects a non-administrator', () => {
    const forbidden = { ...actor, role: 'user' as const };
    const { store } = setup();
    const subject = new ReadTlsSettings(store);

    const operation = () => subject.execute(forbidden);

    expect(operation).toThrow(expect.objectContaining({ code: 'forbidden' }));
});
it('rejects incomplete password setup', () => {
    const forbidden = { ...actor, mustChangePassword: true };
    const { store } = setup();
    const subject = new ReadTlsSettings(store);

    const operation = () => subject.execute(forbidden);

    expect(operation).toThrow(expect.objectContaining({ code: 'forbidden' }));
});
