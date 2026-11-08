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

    constructor(private readonly directoryUrl: string = AcmeConnector.letsEncrypt) {}

    open(accountKey: Buffer): AcmeSession {
        return new acme.Client({ directoryUrl: this.directoryUrl, accountKey });
    }
}
