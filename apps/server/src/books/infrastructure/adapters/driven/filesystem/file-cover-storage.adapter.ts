import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CoverStorage } from '../../../../application/ports/driven/cover-storage.interface.js';
import type { CoverMediaType } from '../../../../domain/value-objects/cover-image.value-object.js';

const extensions: Record<CoverMediaType, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

// Cover images in `<data directory>/covers`, under random names chosen here only.
export class FileCoverStorage implements CoverStorage {
    private static readonly fileName = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

    constructor(private readonly dataDirectory: string) {}

    private get directory(): string {
        return join(this.dataDirectory, 'covers');
    }

    async store(bytes: Uint8Array, mediaType: CoverMediaType): Promise<string> {
        const file = randomUUID() + '.' + extensions[mediaType];

        await mkdir(this.directory, { recursive: true });
        await writeFile(join(this.directory, file), bytes);

        return file;
    }

    async read(file: string): Promise<{ bytes: Uint8Array; mediaType: CoverMediaType } | null> {
        if (!FileCoverStorage.fileName.test(file)) {
            return null;
        }

        try {
            const bytes = await readFile(join(this.directory, file));
            const mediaType = (Object.keys(extensions) as CoverMediaType[]).find((type) =>
                file.endsWith('.' + extensions[type]),
            )!;

            return { bytes, mediaType };
        } catch {
            return null;
        }
    }

    async remove(file: string): Promise<void> {
        if (FileCoverStorage.fileName.test(file)) {
            await rm(join(this.directory, file), { force: true });
        }
    }

    async list(): Promise<string[]> {
        try {
            const files = await readdir(this.directory);

            return files.filter((file) => FileCoverStorage.fileName.test(file));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }

            throw error;
        }
    }
}
