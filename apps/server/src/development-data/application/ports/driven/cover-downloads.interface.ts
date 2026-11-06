// Cover images of the V1 dump, by their V1 address (a web address or an inline data address).
export interface CoverDownloads {
    // The image bytes of each address that could be obtained, by address; the others are absent.
    fetchAll(urls: readonly string[]): Promise<Map<string, Uint8Array>>;
}
