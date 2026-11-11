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

        const issued = certificate.issuedAt.getTime();
        const renewal = issued + (certificate.expiresAt.getTime() - issued) * share;

        return now.getTime() >= renewal;
    }

    static retryAt(failedAttempts: number, now: Date): Date {
        const delay = Math.min(
            RenewalPolicy.firstRetryDelay * 2 ** Math.max(0, failedAttempts - 1),
            RenewalPolicy.longestRetryDelay,
        );

        return new Date(now.getTime() + delay);
    }
}
