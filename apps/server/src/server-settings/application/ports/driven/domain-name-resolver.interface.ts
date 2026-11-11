export interface DomainNameResolver {
    addresses(name: string): Promise<string[]>;
}
