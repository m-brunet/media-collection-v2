import type { CoverMediaType } from '../../../domain/value-objects/cover-image.value-object.js';

export interface CoverStorage {
    store(bytes: Uint8Array, mediaType: CoverMediaType): Promise<string>;
    read(file: string): Promise<{ bytes: Uint8Array; mediaType: CoverMediaType } | null>;
    remove(file: string): Promise<void>;
    // Every stored cover's file name; files the storage did not name are not listed.
    list(): Promise<string[]>;
}
