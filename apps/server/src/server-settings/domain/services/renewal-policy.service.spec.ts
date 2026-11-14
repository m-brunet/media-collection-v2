import { expect, it } from 'vitest';
import { IssuedCertificate } from '../value-objects/issued-certificate.value-object.js';
import { RenewalPolicy } from './renewal-policy.service.js';

const certificate = new IssuedCertificate({
    address: '82.66.118.204',
    issuedAt: '2026-11-08T10:00:00.000Z',
    expiresAt: '2026-11-14T10:00:00.000Z',
});
const failedAt = new Date('2026-11-08T10:00:00.000Z');

it('keeps a certificate before half of its lifetime', () => {
    const now = new Date('2026-11-11T09:59:59.000Z');

    const due = RenewalPolicy.renewalDue(
        certificate,
        '82.66.118.204',
        RenewalPolicy.addressShare,
        now,
    );

    expect(due).toBe(false);
});
it('renews a certificate at half of its lifetime', () => {
    const now = new Date('2026-11-11T10:00:00.000Z');

    const due = RenewalPolicy.renewalDue(
        certificate,
        '82.66.118.204',
        RenewalPolicy.addressShare,
        now,
    );

    expect(due).toBe(true);
});
it('dates the renewal at the given share of the lifetime', () => {
    const share = RenewalPolicy.domainShare;

    const renewal = RenewalPolicy.renewalAt(certificate, share);

    expect(renewal.toISOString()).toBe('2026-11-12T10:00:00.000Z');
});
it('renews at once when the public address changed', () => {
    const now = new Date('2026-11-08T11:00:00.000Z');

    const due = RenewalPolicy.renewalDue(
        certificate,
        '82.66.118.205',
        RenewalPolicy.addressShare,
        now,
    );

    expect(due).toBe(true);
});
it('asks for a certificate when there is none', () => {
    const now = new Date('2026-11-08T11:00:00.000Z');

    const due = RenewalPolicy.renewalDue(null, '82.66.118.204', RenewalPolicy.addressShare, now);

    expect(due).toBe(true);
});
it('retries one hour after the first failure', () => {
    const attempts = 1;

    const retry = RenewalPolicy.retryAt(attempts, failedAt);

    expect(retry.toISOString()).toBe('2026-11-08T11:00:00.000Z');
});
it('doubles the delay after each further failure', () => {
    const attempts = 3;

    const retry = RenewalPolicy.retryAt(attempts, failedAt);

    expect(retry.toISOString()).toBe('2026-11-08T14:00:00.000Z');
});
it('never waits more than six hours', () => {
    const attempts = 8;

    const retry = RenewalPolicy.retryAt(attempts, failedAt);

    expect(retry.toISOString()).toBe('2026-11-08T16:00:00.000Z');
});

const domainCertificate = new IssuedCertificate({
    address: 'home.example.fr',
    issuedAt: '2026-11-08T10:00:00.000Z',
    expiresAt: '2027-02-06T10:00:00.000Z',
});

it('keeps a domain certificate before two thirds of its lifetime', () => {
    const now = new Date('2027-01-07T09:59:59.000Z');

    const due = RenewalPolicy.renewalDue(
        domainCertificate,
        'home.example.fr',
        RenewalPolicy.domainShare,
        now,
    );

    expect(due).toBe(false);
});
it('renews a domain certificate at two thirds of its lifetime', () => {
    const now = new Date('2027-01-07T10:00:00.000Z');

    const due = RenewalPolicy.renewalDue(
        domainCertificate,
        'home.example.fr',
        RenewalPolicy.domainShare,
        now,
    );

    expect(due).toBe(true);
});
it('renews at once when the certificate covers another domain name', () => {
    const now = new Date('2026-11-08T11:00:00.000Z');

    const due = RenewalPolicy.renewalDue(
        domainCertificate,
        'library.example.fr',
        RenewalPolicy.domainShare,
        now,
    );

    expect(due).toBe(true);
});
