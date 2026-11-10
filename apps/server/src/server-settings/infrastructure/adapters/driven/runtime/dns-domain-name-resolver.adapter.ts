import { resolve4 } from 'node:dns/promises';
import type { DomainNameResolver } from '../../../../application/ports/driven/domain-name-resolver.interface.js';

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
