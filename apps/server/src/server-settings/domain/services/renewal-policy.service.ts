import type { IssuedCertificate } from '../value-objects/issued-certificate.value-object.js';

// When automatic internet access needs a new certificate, and how long it waits after a failure.
export class RenewalPolicy {
    // The first wait after a failure, doubled at each new failure up to the longest one.
    private static readonly firstRetryDelay = 60 * 60 * 1000;
    // Share of the lifetime after which a certificate is renewed: half for a short-lived IP address
    // certificate, two thirds for a domain name (day 60 of a 90-day certificate).
    static readonly addressShare = 1 / 2;
    static readonly domainShare = 2 / 3;
    private static readonly longestRetryDelay = 6 * 60 * 60 * 1000;

    // A certificate is renewed once the given share of its lifetime has passed, or at once when it
    // does not cover the name phones use (a changed public address, another domain name).
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

    // One hour after the first failure, then doubling, never more than six hours.
    static retryAt(failedAttempts: number, now: Date): Date {
        const delay = Math.min(
            RenewalPolicy.firstRetryDelay * 2 ** Math.max(0, failedAttempts - 1),
            RenewalPolicy.longestRetryDelay,
        );

        return new Date(now.getTime() + delay);
    }
}
