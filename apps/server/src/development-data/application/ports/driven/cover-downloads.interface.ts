export interface CoverDownloads {
    fetchAll(urls: readonly string[]): Promise<Map<string, Uint8Array>>;
}
