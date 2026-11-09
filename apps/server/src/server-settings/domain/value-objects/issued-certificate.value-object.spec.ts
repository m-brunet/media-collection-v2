import { expect, it } from 'vitest';
import { IssuedCertificate } from './issued-certificate.value-object.js';

const certificate = new IssuedCertificate({
    address: '82.66.118.204',
    issuedAt: '2026-11-08T10:00:00.000Z',
    expiresAt: '2026-11-14T10:00:00.000Z',
});

it('is valid just before it expires', () => {
    const now = new Date('2026-11-14T09:59:59.000Z');

    const valid = certificate.validAt(now);

    expect(valid).toBe(true);
});
it('is no longer valid when it expires', () => {
    const now = new Date('2026-11-14T10:00:00.000Z');

    const valid = certificate.validAt(now);

    expect(valid).toBe(false);
});
it('rejects a certificate that expires before it was issued', () => {
    const state = {
        address: '82.66.118.204',
        issuedAt: '2026-11-14T10:00:00.000Z',
        expiresAt: '2026-11-08T10:00:00.000Z',
    };

    const operation = () => new IssuedCertificate(state);

    expect(operation).toThrow('expire after');
});
it('rejects an unreadable date', () => {
    const state = {
        address: '82.66.118.204',
        issuedAt: 'soon',
        expiresAt: '2026-11-08T10:00:00.000Z',
    };

    const operation = () => new IssuedCertificate(state);

    expect(operation).toThrow('expire after');
});
