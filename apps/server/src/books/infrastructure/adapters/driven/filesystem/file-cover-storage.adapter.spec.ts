import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { FileCoverStorage } from './file-cover-storage.adapter.js';

const directories: string[] = [];

afterEach(() => {
    for (const directory of directories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

function directory() {
    const value = mkdtempSync(join(tmpdir(), 'cover-storage-'));

    directories.push(value);

    return value;
}

describe('FileCoverStorage', () => {
    it('stores an image under a generated name in the covers folder', async () => {
        const data = directory();

        const file = await new FileCoverStorage(data).store(new Uint8Array([1, 2]), 'image/webp');

        expect(file).toMatch(/^[0-9a-f-]{36}\.webp$/);
        expect(readdirSync(join(data, 'covers'))).toEqual([file]);
    });
    it('reads a stored image with its type', async () => {
        const storage = new FileCoverStorage(directory());
        const file = await storage.store(new Uint8Array([1, 2]), 'image/jpeg');

        const result = await storage.read(file);

        expect(result).toEqual({ bytes: Buffer.from([1, 2]), mediaType: 'image/jpeg' });
    });
    it('never reads a name it could not have generated', async () => {
        const data = directory();

        writeFileSync(join(data, 'secret.png'), 'secret');

        const result = await new FileCoverStorage(data).read('../secret.png');

        expect(result).toBeNull();
    });
    it('removes a stored image', async () => {
        const data = directory();
        const storage = new FileCoverStorage(data);
        const file = await storage.store(new Uint8Array([1]), 'image/png');

        await storage.remove(file);

        expect(existsSync(join(data, 'covers', file))).toBe(false);
    });
});
