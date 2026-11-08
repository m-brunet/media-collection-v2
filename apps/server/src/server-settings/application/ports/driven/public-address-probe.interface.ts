// Asks a public service which IPv4 address the home connection uses; null when it cannot tell.
export interface PublicAddressProbe {
    current(): Promise<string | null>;
}
