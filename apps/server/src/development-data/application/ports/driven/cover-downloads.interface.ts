// Cover images of the V1 dump, by their V1 address (a web address or an inline data address).
export interface CoverDownloads {
    // The image bytes, or null when they cannot be obtained.
    fetch(url: string): Promise<Uint8Array | null>;
}
