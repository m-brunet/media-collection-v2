export interface DomainNameReader {
    read(): Promise<string | null>;
}
