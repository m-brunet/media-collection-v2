export interface ManualPortRule {
    localAddress: string | null;
    internalPort: number;
    externalPort: number;
    protocol: 'TCP';
}
