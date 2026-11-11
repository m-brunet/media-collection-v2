import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Module } from '@nestjs/common';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryModules } from '../../apps/server/src/infrastructure/config/library-modules.js';
import { Database } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import { KyselyAuditTrail } from '../../apps/server/src/shared/infrastructure/adapters/driven/persistence/kysely-audit-trail.adapter.js';
import { SystemClock } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/system-clock.adapter.js';
import { UuidGenerator } from '../../apps/server/src/shared/infrastructure/adapters/driven/runtime/uuid-generator.adapter.js';
import { AuditedOperation } from '../../apps/server/src/shared/application/services/audited-operation.service.js';

class LibraryContext {}
Module({})(LibraryContext);

const cleanups: (() => Promise<void>)[] = [];

afterEach(async () => {
    for (const cleanup of cleanups.splice(0).reverse()) {
        await cleanup();
    }
});

async function library(options?: {
    developmentImport?: boolean;
}): Promise<INestApplicationContext> {
    const dataDirectory = await mkdtemp(join(tmpdir(), 'library-modules-'));

    cleanups.push(() => rm(dataDirectory, { recursive: true, force: true }));
    const ids = new UuidGenerator();
    const clock = new SystemClock();
    const database = await Database.open(dataDirectory, ids);

    cleanups.push(() => database.close());
    const operations = new AuditedOperation(
        database.connections,
        new KyselyAuditTrail(database.connections, ids),
        clock,
        ids,
    );
    const context = await NestFactory.createApplicationContext(
        {
            module: LibraryContext,
            imports: LibraryModules.register(
                { database, dataDirectory, ids, clock, operations },
                options,
            ),
        },
        { logger: false, abortOnError: false },
    );

    cleanups.push(() => context.close());

    return context;
}

describe('LibraryModules', () => {
    it('leaves the development V1 import out of the HTTP backend', async () => {
        const context = await library();

        const result = () => context.get('BOOKS_IMPORT', { strict: false });

        expect(result).toThrow('Nest could not find BOOKS_IMPORT element');
    });
    it('provides the development V1 import to the development data commands', async () => {
        const context = await library({ developmentImport: true });

        const result = context.get('BOOKS_IMPORT', { strict: false });

        expect(result).toHaveProperty('execute');
    });
});
