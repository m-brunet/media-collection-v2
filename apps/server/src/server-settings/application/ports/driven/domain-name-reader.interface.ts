// The Admin's saved domain name, or null when there is none.
export interface DomainNameReader {
    read(): Promise<string | null>;
}
