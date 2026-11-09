import type { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import type { InternetAccessFailureReason } from '../../domain/entities/internet-access.entity.js';
import type { DomainNameResolver } from '../ports/driven/domain-name-resolver.interface.js';

export type DomainNameProblem = Extract<
    InternetAccessFailureReason,
    'domain-unresolved' | 'domain-mismatch'
>;

// Whether the Admin's domain name points to the home's public address, as Let's Encrypt and phones
// need. Without a domain name there is nothing to check.
export class DomainNameCheck {
    constructor(private readonly resolver: DomainNameResolver) {}

    async problem(access: InternetAccess): Promise<DomainNameProblem | null> {
        if (!access.domain) {
            return null;
        }

        const addresses = await this.resolver.addresses(access.domain);

        if (addresses.length === 0) {
            return 'domain-unresolved';
        }

        return addresses.includes(access.publicAddress ?? '') ? null : 'domain-mismatch';
    }
}
