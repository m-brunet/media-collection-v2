export interface LocalAddressReader {
    current(): Promise<string | null>;
}
