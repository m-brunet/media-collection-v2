export interface PairingAddresses {
    accepts(address: string): Promise<boolean>;
}
