import { expect, it } from 'vitest';
import { TlsSettings } from './tls-settings.value-object.js';

it('accepts disabled TLS at the minimum port', () => {
    const input = { enabled: false, port: 1024, hasCertificate: false };
    const settings = { ...input };

    const operation = () => new TlsSettings(settings);

    expect(operation).not.toThrow();
});
it('accepts enabled TLS at the maximum port', () => {
    const input = { enabled: true, port: 65535, hasCertificate: true };
    const settings = { ...input };

    const operation = () => new TlsSettings(settings);

    expect(operation).not.toThrow();
});
it('rejects port zero', () => {
    const input = { enabled: false, port: 0, hasCertificate: false };
    const settings = { ...input };

    const operation = () => new TlsSettings(settings);

    expect(operation).toThrow();
});
it('rejects a HTTPS port just below the minimum', () => {
    const settings = { enabled: false, port: 1023, hasCertificate: false };

    const operation = () => new TlsSettings(settings);

    expect(operation).toThrow('1024');
});
it('accepts a chosen HTTPS listening port', () => {
    const settings = { enabled: true, port: 36000, hasCertificate: true };

    const operation = () => new TlsSettings(settings);

    expect(operation).not.toThrow();
});
it('rejects a negative HTTPS port', () => {
    const settings = { enabled: false, port: -1, hasCertificate: false };

    const operation = () => new TlsSettings(settings);

    expect(operation).toThrow();
});
it('rejects a port above the maximum', () => {
    const input = { enabled: false, port: 65536, hasCertificate: false };
    const settings = { ...input };

    const operation = () => new TlsSettings(settings);

    expect(operation).toThrow();
});
it('rejects a fractional port', () => {
    const input = { enabled: false, port: 1.5, hasCertificate: false };
    const settings = { ...input };

    const operation = () => new TlsSettings(settings);

    expect(operation).toThrow();
});
it('rejects enabled TLS without a certificate', () => {
    const input = { enabled: true, port: 3443, hasCertificate: false };
    const settings = { ...input };

    const operation = () => new TlsSettings(settings);

    expect(operation).toThrow();
});
