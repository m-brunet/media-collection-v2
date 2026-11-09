import { resolve4 } from 'node:dns/promises';
import type { DomainNameResolver } from '../../../../application/ports/driven/domain-name-resolver.interface.js';

// Asks the computer's DNS servers for the name's IPv4 addresses (A records). A missing name, a
// name without IPv4 address and a failed lookup all answer an empty list.
export class DnsDomainNameResolver implements DomainNameResolver {
    constructor(private readonly lookup: (name: string) => Promise<string[]> = resolve4) {}

    async addresses(name: string): Promise<string[]> {
        try {
            return await this.lookup(name);
        } catch {
            return [];
        }
    }
}
