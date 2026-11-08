import { generate } from 'selfsigned';

// Browser journeys replace the home router, Let's Encrypt and the public address service. The
// router reports `externalAddress` (null: no router answers) and accepts the rule when `accepts`.
// The certificate is self-signed for the address, valid 160 hours like a Let's Encrypt one.
export class InternetAccessStandIns {
    static fromEnvironment(value) {
        if (!value) {
            return undefined;
        }

        const { externalAddress, accepts } = JSON.parse(value);

        return {
            router: {
                find: async () => (externalAddress ? { mapping: 'upnp', externalAddress } : null),
                open: async () => accepts,
                close: async () => undefined,
            },
            probe: { current: async () => externalAddress },
            authority: {
                issue: async (address) => {
                    const issuedAt = new Date();
                    const expiresAt = new Date(issuedAt.getTime() + 160 * 3_600_000);
                    const certificate = await generate([{ name: 'commonName', value: address }], {
                        keySize: 2048,
                        notBeforeDate: issuedAt,
                        notAfterDate: expiresAt,
                    });

                    return {
                        outcome: 'issued',
                        certificate: {
                            chain: certificate.cert,
                            key: certificate.private,
                            issuedAt: issuedAt.toISOString(),
                            expiresAt: expiresAt.toISOString(),
                        },
                    };
                },
            },
        };
    }
}
