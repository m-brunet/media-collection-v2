import type { IssuedCertificate } from '../value-objects/issued-certificate.value-object.js';

// When automatic internet access needs a new certificate, and how long it waits after a failure.
export class RenewalPolicy {
    static readonly upkeepInterval = 60 * 60 * 1000;
    private static readonly longestRetryDelay = 6 * 60 * 60 * 1000;

    // A certificate is renewed once less than half of its lifetime remains, or at once when the
    // public address changed.
    static renewalDue(certificate: IssuedCertificate | null, address: string, now: Date): boolean {
        if (!certificate || certificate.address !== address) {
            return true;
        }

        const issued = certificate.issuedAt.getTime();
        const halfway = issued + (certificate.expiresAt.getTime() - issued) / 2;

        return now.getTime() >= halfway;
    }

    // One hour after the first failure, then doubling, never more than six hours.
    static retryAt(failedAttempts: number, now: Date): Date {
        const delay = Math.min(
            RenewalPolicy.upkeepInterval * 2 ** Math.max(0, failedAttempts - 1),
            RenewalPolicy.longestRetryDelay,
        );

        return new Date(now.getTime() + delay);
    }
}
