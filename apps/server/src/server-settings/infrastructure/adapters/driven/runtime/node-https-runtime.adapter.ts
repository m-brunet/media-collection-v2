import type { RequestListener } from 'node:http';
import type { Server } from 'node:https';
import { createServer } from 'node:https';
import type { HttpsRuntime } from '../../../../application/ports/driven/https-runtime.interface.js';
import { TlsAlpnChallenges } from '../security/tls-alpn-challenges.adapter.js';

// The HTTPS listener. It can run before any certificate exists: then only Let's Encrypt's
// TLS-ALPN-01 check gets an answer, browsers get a failed handshake. Certificates are swapped
// live, without dropping the listener.
export class NodeHttpsRuntime implements HttpsRuntime {
    private server: Server | undefined;

    constructor(
        private readonly application: RequestListener,
        private readonly host: string,
        private readonly challenges: TlsAlpnChallenges,
    ) {}

    get port(): number | null {
        const address = this.server?.address();

        return address && typeof address !== 'string' ? address.port : null;
    }

    // Startup with the saved certificate; failures are reported by the caller.
    async start(port: number, certificate: { chain: string; key: string } | null): Promise<number> {
        const server = createServer(
            {
                ...(certificate ? { cert: certificate.chain, key: certificate.key } : {}),
                minVersion: 'TLSv1.2',
                SNICallback: (name, done) => done(null, this.challenges.contextFor(name)),
                ALPNCallback: ({ servername, protocols }) => this.protocol(servername, protocols),
            },
            this.application,
        );

        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, this.host, () => {
                server.off('error', reject);
                resolve();
            });
        });
        this.server = server;

        return this.port!;
    }

    async ensureRunning(port: number): Promise<boolean> {
        if (this.server?.listening) {
            return this.port === port;
        }

        return this.start(port, null).then(
            () => true,
            () => false,
        );
    }

    async install(port: number, certificate: { chain: string; key: string }): Promise<boolean> {
        if (!this.server?.listening) {
            return this.start(port, certificate).then(
                () => true,
                () => false,
            );
        }

        this.server.setSecureContext({
            cert: certificate.chain,
            key: certificate.key,
            minVersion: 'TLSv1.2',
        });

        return this.port === port;
    }

    close(): Promise<void> {
        const server = this.server;

        this.server = undefined;

        if (!server?.listening) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => server.closeAllConnections(), 5000);

            timer.unref();
            server.close((error) => {
                clearTimeout(timer);

                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
            server.closeIdleConnections();
        });
    }

    // Only Let's Encrypt asks for `acme-tls/1`, and only for a waiting challenge; browsers get HTTP/1.1.
    private protocol(serverName: string, protocols: string[]): string | undefined {
        if (
            protocols.includes(TlsAlpnChallenges.protocol) &&
            this.challenges.contextFor(serverName)
        ) {
            return TlsAlpnChallenges.protocol;
        }

        return protocols.includes('http/1.1') ? 'http/1.1' : undefined;
    }
}
