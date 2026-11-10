// What this installation asked Let's Encrypt for one name (public address or domain name): a new
// certificate (an ARI renewal is not one) or a failed check of the port.
export interface CertificateAttempt {
    name: string;
    at: string;
    kind: 'certificate' | 'failed-check';
}

// `nextAt`: when one more attempt comes back, given only while none is left.
export interface Allowance {
    left: number;
    nextAt: string | null;
}

interface Bucket {
    kind: CertificateAttempt['kind'];
    capacity: number;
    refillMs: number;
}

// An estimate of Let's Encrypt's limits from this installation's own attempts, starting full: other
// software using the same address also counts, and Let's Encrypt does not say how much is left.
// Limits (letsencrypt.org/docs/rate-limits, 2026-08-05): 5 certificates per exact set of
// identifiers, one back every 34 hours; 5 failed checks per identifier and account, one back every
// 12 minutes.
export class AttemptAllowance {
    // Longer than a full refill of the certificate bucket (5 × 34 hours).
    static readonly keptMs = 8 * 24 * 60 * 60 * 1000;
    private static readonly certificates: Bucket = {
        kind: 'certificate',
        capacity: 5,
        refillMs: 34 * 60 * 60 * 1000,
    };
    private static readonly checks: Bucket = {
        kind: 'failed-check',
        capacity: 5,
        refillMs: 12 * 60 * 1000,
    };

    static certificatesLeft(
        history: readonly CertificateAttempt[],
        name: string,
        now: Date,
    ): Allowance {
        return AttemptAllowance.left(AttemptAllowance.certificates, history, name, now);
    }

    static checksLeft(history: readonly CertificateAttempt[], name: string, now: Date): Allowance {
        return AttemptAllowance.left(AttemptAllowance.checks, history, name, now);
    }

    // The attempts still worth keeping at `now`.
    static recent(history: readonly CertificateAttempt[], now: Date): CertificateAttempt[] {
        return history.filter(
            (attempt) => now.getTime() - Date.parse(attempt.at) < AttemptAllowance.keptMs,
        );
    }

    private static left(
        bucket: Bucket,
        history: readonly CertificateAttempt[],
        name: string,
        now: Date,
    ): Allowance {
        const times = AttemptAllowance.recent(history, now)
            .filter((attempt) => attempt.name === name && attempt.kind === bucket.kind)
            .map((attempt) => Date.parse(attempt.at))
            .sort((first, second) => first - second);
        let tokens = bucket.capacity;
        let last: number | null = null;

        for (const at of times) {
            tokens = AttemptAllowance.refilled(bucket, tokens, last, at);
            tokens = Math.max(0, tokens - 1);
            last = at;
        }

        tokens = AttemptAllowance.refilled(bucket, tokens, last, now.getTime());
        const left = Math.floor(tokens);

        return {
            left,
            nextAt:
                left > 0
                    ? null
                    : new Date(
                          now.getTime() + Math.ceil((1 - tokens) * bucket.refillMs),
                      ).toISOString(),
        };
    }

    private static refilled(
        bucket: Bucket,
        tokens: number,
        last: number | null,
        at: number,
    ): number {
        return last === null
            ? tokens
            : Math.min(bucket.capacity, tokens + (at - last) / bucket.refillMs);
    }
}
