export interface PublicAddressProbe {
    current(): Promise<string | null>;
}
