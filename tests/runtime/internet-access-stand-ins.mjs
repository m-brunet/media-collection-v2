import { generate } from 'selfsigned';

export class InternetAccessStandIns {
    static fromEnvironment(value) {
        if (!value) {
            return undefined;
        }

        const { externalAddress, accepts, domainAddress } = JSON.parse(value);

        return {
            router: {
                find: async () => (externalAddress ? { mapping: 'upnp', externalAddress } : null),
                open: async () => accepts,
                close: async () => undefined,
            },
            probe: { current: async () => externalAddress },
            resolver: {
                addresses: async () => {
                    const address = domainAddress ?? externalAddress;

                    return address ? [address] : [];
                },
            },
            authority: {
                issue: async ({ name: address }) => {
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
