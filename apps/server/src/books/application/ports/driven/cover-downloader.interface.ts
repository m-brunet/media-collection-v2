// Downloads an image a lookup source offered; null when it cannot be fetched or is too large.
export interface CoverDownloader {
    download(address: string): Promise<Uint8Array | null>;
}
