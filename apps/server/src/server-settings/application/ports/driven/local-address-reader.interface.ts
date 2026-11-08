// The computer's address on the home network, for the manual router rule.
export interface LocalAddressReader {
    current(): Promise<string | null>;
}
