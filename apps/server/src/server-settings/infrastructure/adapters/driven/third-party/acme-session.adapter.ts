import acme from 'acme-client';

// The part of an ACME client the certificate authority uses, so tests can stand in for
// Let's Encrypt.
export type AcmeSession = Pick<
    acme.Client,
    | 'createAccount'
    | 'createOrder'
    | 'getAuthorizations'
    | 'getChallengeKeyAuthorization'
    | 'completeChallenge'
    | 'waitForValidStatus'
    | 'finalizeOrder'
    | 'getCertificate'
>;

export class AcmeConnector {
    static readonly letsEncrypt = acme.directory.letsencrypt.production;

    constructor(
        private readonly directoryUrl: string = AcmeConnector.letsEncrypt,
        private readonly requestTimeoutMs = 30_000,
    ) {}

    open(accountKey: Buffer): AcmeSession {
        // acme-client otherwise waits out Let's Encrypt's Retry-After in silence: a rate limit
        // would leave the setup "in progress" for days. Failures must come back at once; the
        // upkeep retries with its own growing delays. The settings are shared by every client.
        (
            acme.axios.defaults as unknown as { acmeSettings: { retryMaxAttempts: number } }
        ).acmeSettings.retryMaxAttempts = 0;
        acme.axios.defaults.timeout = this.requestTimeoutMs;

        return new acme.Client({ directoryUrl: this.directoryUrl, accountKey });
    }
}
