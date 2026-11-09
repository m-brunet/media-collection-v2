import { afterEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { KyselyInternetAccessRepository } from '../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-internet-access.repository.js';
import { KyselyKeepAwakeRepository } from '../../apps/server/src/server-settings/infrastructure/adapters/driven/persistence/kysely-keep-awake.repository.js';
import { InternetAccess } from '../../apps/server/src/server-settings/domain/entities/internet-access.entity.js';
import { DataDirectories } from './data-directories.test-support.js';

const directories = new DataDirectories();
const databases: Database[] = [];

afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.close()));
    await directories.cleanup();
});

async function open(directory?: string) {
    const path = directory ?? (await directories.empty('internet-access-'));
    const database = await Database.open(path, new UuidGenerator());

    databases.push(database);

    return { path, database };
}

function activeAccess(): InternetAccess {
    const access = InternetAccess.off();
    const now = new Date('2026-11-08T10:00:00.000Z');

    access.start(null);
    access.routerFound('upnp', '82.66.118.204', now);
    access.portOpened();
    access.activate({
        address: '82.66.118.204',
        issuedAt: '2026-11-08T10:00:00.000Z',
        expiresAt: '2026-11-15T02:00:00.000Z',
    });

    return access;
}

it('reads internet access as off when nothing was saved', async () => {
    const { database } = await open();
    const repository = new KyselyInternetAccessRepository(
        database.connections,
        new UuidGenerator(),
    );

    const access = await repository.read();

    expect(access.snapshot).toEqual(InternetAccess.off().snapshot);
});
it('keeps active internet access across a restart', async () => {
    const first = await open();

    await new KyselyInternetAccessRepository(first.database.connections, new UuidGenerator()).save(
        activeAccess(),
    );
    await first.database.close();
    databases.splice(0);
    const { database } = await open(first.path);
    const repository = new KyselyInternetAccessRepository(
        database.connections,
        new UuidGenerator(),
    );

    const access = await repository.read();

    expect(access.snapshot).toEqual(activeAccess().snapshot);
});
it('rejects saved internet access with an unknown phase', async () => {
    const { database } = await open();

    await database.connection
        .insertInto('server_settings')
        .values({ id: randomUUID(), name: 'internet-access', value: '{"phase":"sleeping"}' })
        .execute();
    const repository = new KyselyInternetAccessRepository(
        database.connections,
        new UuidGenerator(),
    );

    const result = repository.read();

    await expect(result).rejects.toThrow('known phase');
});
it('rejects saved active internet access without a certificate', async () => {
    const { database } = await open();

    await database.connection
        .insertInto('server_settings')
        .values({
            id: randomUUID(),
            name: 'internet-access',
            value: '{"phase":"active","mapping":"upnp","publicAddress":"82.66.118.204"}',
        })
        .execute();
    const repository = new KyselyInternetAccessRepository(
        database.connections,
        new UuidGenerator(),
    );

    const result = repository.read();

    await expect(result).rejects.toThrow('needs a certificate');
});
it('reads keep awake as off when nothing was saved', async () => {
    const { database } = await open();
    const repository = new KyselyKeepAwakeRepository(database.connections, new UuidGenerator());

    const enabled = await repository.read();

    expect(enabled).toBe(false);
});
it('keeps the keep-awake setting across a restart', async () => {
    const first = await open();

    await new KyselyKeepAwakeRepository(first.database.connections, new UuidGenerator()).save(true);
    await first.database.close();
    databases.splice(0);
    const { database } = await open(first.path);
    const repository = new KyselyKeepAwakeRepository(database.connections, new UuidGenerator());

    const enabled = await repository.read();

    expect(enabled).toBe(true);
});
it('rejects a saved keep-awake setting that is not true or false', async () => {
    const { database } = await open();

    await database.connection
        .insertInto('server_settings')
        .values({ id: randomUUID(), name: 'keep-awake', value: '{"enabled":"yes"}' })
        .execute();
    const repository = new KyselyKeepAwakeRepository(database.connections, new UuidGenerator());

    const result = repository.read();

    await expect(result).rejects.toThrow('true or false');
});
