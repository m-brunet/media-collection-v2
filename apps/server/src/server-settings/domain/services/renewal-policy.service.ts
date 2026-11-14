import type { IssuedCertificate } from '../value-objects/issued-certificate.value-object.js';

export class RenewalPolicy {
    private static readonly firstRetryDelay = 60 * 60 * 1000;
    static readonly addressShare = 1 / 2;
    static readonly domainShare = 2 / 3;
    private static readonly longestRetryDelay = 6 * 60 * 60 * 1000;

    static renewalDue(
        certificate: IssuedCertificate | null,
        name: string,
        share: number,
        now: Date,
    ): boolean {
        if (!certificate || certificate.address !== name) {
            return true;
        }

        return now.getTime() >= RenewalPolicy.renewalAt(certificate, share).getTime();
    }

    static renewalAt(certificate: IssuedCertificate, share: number): Date {
        const issued = certificate.issuedAt.getTime();

        return new Date(issued + (certificate.expiresAt.getTime() - issued) * share);
    }

    static retryAt(failedAttempts: number, now: Date): Date {
        const delay = Math.min(
            RenewalPolicy.firstRetryDelay * 2 ** Math.max(0, failedAttempts - 1),
            RenewalPolicy.longestRetryDelay,
        );

        return new Date(now.getTime() + delay);
    }
}
