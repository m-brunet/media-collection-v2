import { expect, it } from 'vitest';
import type { CertificateAttempt } from './attempt-allowance.service.js';
import { AttemptAllowance } from './attempt-allowance.service.js';

const address = '82.66.118.204';
const now = new Date('2026-11-10T12:00:00.000Z');

function attempts(kind: CertificateAttempt['kind'], ...ats: string[]): CertificateAttempt[] {
    return ats.map((at) => ({ name: address, at, kind }));
}

it('counts 5 certificates left with no attempt known', () => {
    const allowance = AttemptAllowance.certificatesLeft([], address, now);

    expect(allowance).toEqual({ left: 5, nextAt: null });
});
it('counts one certificate fewer for each one issued this week', () => {
    const history = attempts('certificate', '2026-11-10T10:00:00.000Z', '2026-11-10T11:00:00.000Z');

    const allowance = AttemptAllowance.certificatesLeft(history, address, now);

    expect(allowance).toEqual({ left: 3, nextAt: null });
});
it('gives a certificate back 34 hours after one was used', () => {
    const history = attempts('certificate', '2026-11-08T22:00:00.000Z', '2026-11-10T11:00:00.000Z');

    const allowance = AttemptAllowance.certificatesLeft(history, address, now);

    expect(allowance).toEqual({ left: 4, nextAt: null });
});
it('says when a certificate comes back once none is left', () => {
    const history = attempts(
        'certificate',
        '2026-11-10T08:00:00.000Z',
        '2026-11-10T08:00:00.000Z',
        '2026-11-10T08:00:00.000Z',
        '2026-11-10T08:00:00.000Z',
        '2026-11-10T08:00:00.000Z',
    );

    const allowance = AttemptAllowance.certificatesLeft(history, address, now);

    expect(allowance).toEqual({ left: 0, nextAt: '2026-11-11T18:00:00.000Z' });
});
it('counts only the certificates of the same name', () => {
    const history: CertificateAttempt[] = [
        { name: 'home.example.fr', at: '2026-11-10T10:00:00.000Z', kind: 'certificate' },
    ];

    const allowance = AttemptAllowance.certificatesLeft(history, address, now);

    expect(allowance).toEqual({ left: 5, nextAt: null });
});
it('counts no failed check as a certificate', () => {
    const history = attempts('failed-check', '2026-11-10T11:59:00.000Z');

    const allowance = AttemptAllowance.certificatesLeft(history, address, now);

    expect(allowance).toEqual({ left: 5, nextAt: null });
});
it('counts one check fewer for each failed check this hour', () => {
    const history = attempts(
        'failed-check',
        '2026-11-10T11:59:00.000Z',
        '2026-11-10T11:59:30.000Z',
    );

    const allowance = AttemptAllowance.checksLeft(history, address, now);

    expect(allowance).toEqual({ left: 3, nextAt: null });
});
it('says when a check comes back once none is left', () => {
    const history = attempts(
        'failed-check',
        '2026-11-10T12:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
        '2026-11-10T12:00:00.000Z',
    );

    const allowance = AttemptAllowance.checksLeft(history, address, now);

    expect(allowance).toEqual({ left: 0, nextAt: '2026-11-10T12:12:00.000Z' });
});
it('gives a check back 12 minutes after a failure', () => {
    const history = attempts('failed-check', '2026-11-10T11:48:00.000Z');

    const allowance = AttemptAllowance.checksLeft(history, address, now);

    expect(allowance).toEqual({ left: 5, nextAt: null });
});
it('keeps the attempts of the last 8 days', () => {
    const history = attempts('certificate', '2026-11-02T12:00:01.000Z', '2026-11-02T11:59:59.000Z');

    const recent = AttemptAllowance.recent(history, now);

    expect(recent).toEqual(attempts('certificate', '2026-11-02T12:00:01.000Z'));
});
