// The values the Admin enters in the router when it cannot be configured automatically.
export interface ManualPortRule {
    localAddress: string | null;
    internalPort: number;
    externalPort: number;
    protocol: 'TCP';
}
