export interface ListenerAddressReader {
    current(): Promise<string[]>;
}
