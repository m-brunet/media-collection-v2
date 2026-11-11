export interface LookupCoverRegistry {
    register(address: string): string;
    address(token: string): string | null;
}
