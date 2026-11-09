// Looks up the IPv4 addresses (A records) a domain name points to; empty when the name has none or
// the lookup fails.
export interface DomainNameResolver {
    addresses(name: string): Promise<string[]>;
}
