import type {
    CertificateAuthority,
    CertificateIssue,
} from '../../../../application/ports/driven/certificate-authority.interface.js';
import type { DomainNameResolver } from '../../../../application/ports/driven/domain-name-resolver.interface.js';
import type { PublicAddressProbe } from '../../../../application/ports/driven/public-address-probe.interface.js';
import type { RouterConnection } from '../../../../application/ports/driven/router-connection.interface.js';
import type { RouterGateway } from '../../../../application/ports/driven/router-gateway.interface.js';

type OfflinePorts = RouterGateway & PublicAddressProbe & DomainNameResolver & CertificateAuthority;

// Internet access without the internet, for test launches (`APP_OFFLINE_INTERNET_ACCESS=1`): no
// router answers, no public address or DNS answer, and Let's Encrypt is never asked. No test can
// then reach a real router, Let's Encrypt, the public address service or DNS.
export class OfflineInternetAccess implements OfflinePorts {
    static adapters(): {
        router: RouterGateway;
        probe: PublicAddressProbe;
        resolver: DomainNameResolver;
        authority: CertificateAuthority;
    } {
        const offline = new OfflineInternetAccess();

        return { router: offline, probe: offline, resolver: offline, authority: offline };
    }

    async find(): Promise<RouterConnection | null> {
        return null;
    }

    async open(): Promise<boolean> {
        return false;
    }

    async close(): Promise<void> {}

    async current(): Promise<string | null> {
        return null;
    }

    async addresses(): Promise<string[]> {
        return [];
    }

    async issue(): Promise<CertificateIssue> {
        return { outcome: 'refused', reason: 'authority-unavailable' };
    }
}
