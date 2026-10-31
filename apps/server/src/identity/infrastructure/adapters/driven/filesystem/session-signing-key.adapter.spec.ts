import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionSigningKey } from './session-signing-key.adapter.js';
import { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';

const directories: string[] = [];

afterEach(async () => {
    for (const directory of directories.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe('session signing key', () => {
    it('persists and reuses a valid key', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'session-key-'));

        directories.push(directory);
        const subject = new SessionSigningKey(new PrivateStorage());
        const first = subject.load(directory);

        const second = subject.load(directory);

        expect(first).toHaveLength(32);
        expect(second).toEqual(first);
    });
    it('rejects an invalid persisted key', async () => {
        const directory = await mkdtemp(join(tmpdir(), 'session-key-'));

        directories.push(directory);
        await writeFile(join(directory, 'session.key'), Buffer.alloc(4));
        const subject = new SessionSigningKey(new PrivateStorage());

        const invalidKey = () => subject.load(directory);

        expect(invalidKey).toThrow('The saved session signing key is invalid.');
    });
});
