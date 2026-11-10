import type { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import type { DomainNameResolver } from '../ports/driven/domain-name-resolver.interface.js';

export type DomainNameProblem = Extract<
    InternetAccessFailureReason,
    'domain-unresolved' | 'domain-mismatch'
>;

export class DomainNameCheck {
    constructor(private readonly resolver: DomainNameResolver) {}

    async problem(access: InternetAccess): Promise<DomainNameProblem | null> {
        return access.domain ? this.problemFor(access.domain, access.publicAddress) : null;
    }

    async problemFor(name: string, address: string | null): Promise<DomainNameProblem | null> {
        const addresses = await this.resolver.addresses(name);

        if (addresses.length === 0) {
            return 'domain-unresolved';
        }

        return address !== null && addresses.includes(address) ? null : 'domain-mismatch';
    }
}
