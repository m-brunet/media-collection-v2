import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { KyselyIconSetRepository } from '../../apps/server/src/appearance/infrastructure/adapters/driven/persistence/kysely-icon-set.repository.js';
import { IconSet } from '../../apps/server/src/appearance/domain/value-objects/icon-set.value-object.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();
const databases: Database[] = [];

afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.close()));
    await directories.cleanup();
});

async function open(directory?: string) {
    const path = directory ?? (await directories.empty('icon-set-'));
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);

    return { path, database };
}

it('reads Lucide when no icon set was saved', async () => {
    const { database } = await open();
    const repository = new KyselyIconSetRepository(database.connections, new UuidGenerator());

    const set = await repository.read();

    expect(set.name).toBe('lucide');
});
it('keeps the saved icon set across a restart', async () => {
    const first = await open();

    await new KyselyIconSetRepository(first.database.connections, new UuidGenerator()).save(
        new IconSet('architectural-wireframes'),
    );
    await first.database.close();
    databases.splice(0);
    const { database } = await open(first.path);
    const repository = new KyselyIconSetRepository(database.connections, new UuidGenerator());

    const set = await repository.read();

    expect(set.name).toBe('architectural-wireframes');
});
it('rejects a saved icon set setting without an icon set', async () => {
    const { database } = await open();

    await database.connection
        .insertInto('server_settings')
        .values({ id: randomUUID(), name: 'icon-set', value: '{"set":"lucide"}' })
        .execute();
    const repository = new KyselyIconSetRepository(database.connections, new UuidGenerator());

    const result = repository.read();

    await expect(result).rejects.toThrow('must contain an icon set');
});
