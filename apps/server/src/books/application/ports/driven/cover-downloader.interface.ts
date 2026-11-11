export interface CoverDownloader {
    download(address: string): Promise<Uint8Array | null>;
}
