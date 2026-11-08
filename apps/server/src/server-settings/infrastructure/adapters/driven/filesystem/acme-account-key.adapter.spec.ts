import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrivateStorage } from '../../../../../shared/infrastructure/adapters/driven/filesystem/private-storage.adapter.js';
import { AcmeAccountKey } from './acme-account-key.adapter.js';

const directories: string[] = [];

afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

async function accountKey() {
    const directory = await mkdtemp(join(tmpdir(), 'acme-key-'));

    directories.push(directory);

    return new AcmeAccountKey(directory, new PrivateStorage());
}

it('creates a private key on first use', async () => {
    const key = await accountKey();

    const pem = await key.load();

    expect(pem.toString()).toContain('PRIVATE KEY');
});
it('keeps using the same account key', async () => {
    const key = await accountKey();
    const first = await key.load();

    const second = await key.load();

    expect(second.equals(first)).toBe(true);
});
