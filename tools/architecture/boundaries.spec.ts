import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { architectureOverrides, architectureRules } from './config.mjs';

mkdirSync('.cache', { recursive: true });
const root = mkdtempSync(resolve('.cache', 'architecture-'));
const write = (path: string, text: string) => {
    const file = join(root, path);

    mkdirSync(resolve(file, '..'), { recursive: true });
    writeFileSync(file, text);

    return file;
};

write('package.json', '{"type":"module"}');
write('apps/server/src/notes/domain/entities/note.entity.ts', 'export class Note {}');
write(
    'apps/server/src/notes/application/ports/driven/repository.interface.ts',
    'export interface Repository {}',
);
write(
    'apps/server/src/notes/infrastructure/adapters/driven/persistence/database.repository.ts',
    'export class DatabaseRepository {}',
);
write(
    'apps/server/src/notes/infrastructure/adapters/driven/persistence/barrel.ts',
    'export * from "./database.repository.js";',
);
write(
    'apps/server/src/identity/infrastructure/adapters/driven/persistence/user.repository.ts',
    'export class UserRepository {}',
);
write('apps/server/src/shared/domain/actor.ts', 'export interface Actor {}');
write(
    'apps/server/src/notes/application/ports/driving/get-note-use-case.interface.ts',
    'export interface GetNoteUseCase { execute(): void; }',
);
write('packages/contracts/src/note.ts', 'export interface NoteResponse {}');
write(
    'apps/server/src/notes/infrastructure/config/notes.module.ts',
    'export const configured = true;',
);
write(
    'apps/server/src/notes/infrastructure/adapters/driving/web/notes.controller.ts',
    'export class NotesController {}',
);
write('apps/server/src/infrastructure/config/bootstrap.ts', 'export function startBackend() {}');
write(
    'apps/server/src/shared/infrastructure/adapters/driven/runtime/system-clock.adapter.ts',
    'export class SystemClock {}',
);
write(
    'apps/server/src/notes/application/use-cases/list-notes.usecase.ts',
    'export class ListNotes {}',
);
write(
    'apps/server/src/identity/application/ports/driving/authenticate-use-case.interface.ts',
    'export interface AuthenticateUseCase {}',
);
const config = write(
    '.oxlintrc.json',
    JSON.stringify({
        plugins: ['typescript'],
        jsPlugins: [resolve('tools/architecture/plugin.mjs')],
        settings: { architecture: { root } },
        rules: architectureRules,
        overrides: architectureOverrides,
    }),
);
const binary = resolve('node_modules/oxlint/bin/oxlint');

function lint(path: string, source: string) {
    const file = write(path, source);

    return spawnSync(process.execPath, [binary, '--config', config, '--no-ignore', file], {
        cwd: root,
        encoding: 'utf8',
        timeout: 20_000,
    });
}

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('architecture enforcement through the real Oxlint CLI', () => {
    it('accepts valid dependency in apps/server/src/notes/infrastructure/config/database.module.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/config/database.module.ts';
        const source = 'export { Kysely } from "kysely";';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts valid dependency in apps/server/src/notes/application/use-cases/nested/create.usecase.ts', () => {
        const path = 'apps/server/src/notes/application/use-cases/nested/create.usecase.ts';
        const source =
            'import { Note } from "../../../domain/entities/note.entity.js"; export const create = () => new Note();';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts valid dependency in apps/server/src/notes/application/create.ts', () => {
        const path = 'apps/server/src/notes/application/create.ts';
        const source =
            'import type { Actor } from "../../shared/domain/actor.js"; export type Input = Actor;';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts valid dependency in apps/server/src/notes/infrastructure/adapters/driven/persistence/adapter.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driven/persistence/adapter.ts';
        const source =
            'import type { Repository } from "../../../../application/ports/driven/repository.interface.js"; export type Port = Repository;';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts valid dependency in apps/server/src/notes/infrastructure/config/notes.module.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/config/notes.module.ts';
        const source =
            'export { DatabaseRepository } from "../adapters/driven/persistence/database.repository.js";';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts valid dependency in apps/web/src/features/notes/types.ts', () => {
        const path = 'apps/web/src/features/notes/types.ts';
        const source =
            'export type { NoteResponse } from "../../../../../packages/contracts/src/note.js";';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts valid dependency in apps/server/src/notes/application/create.spec.ts', () => {
        const path = 'apps/server/src/notes/application/create.spec.ts';
        const source = 'import { expect } from "vitest"; export const assertion = expect;';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('rejects forbidden dependency in apps/server/src/misplaced.ts', () => {
        const path = 'apps/server/src/misplaced.ts';
        const source = 'export const value = 1;';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driving/web/direct-database.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/direct-database.ts';
        const source = 'export { Kysely } from "kysely";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driving/web/direct-sqlite.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/direct-sqlite.ts';
        const source = 'import Database from "better-sqlite3"; export const database = Database;';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driving/web/file-url.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/file-url.ts';
        const source =
            'export * from ' +
            JSON.stringify(
                pathToFileURL(
                    join(
                        root,
                        'apps/server/src/notes/infrastructure/adapters/driven/persistence/database.repository.ts',
                    ),
                ).href,
            ) +
            ';';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driving/web/absolute.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/absolute.ts';
        const source =
            'export * from ' +
            JSON.stringify(
                join(root, 'apps/server/src/notes/domain/entities/note.entity.ts').replaceAll(
                    '\\',
                    '/',
                ),
            ) +
            ';';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/application/bad.ts', () => {
        const path = 'apps/server/src/notes/application/bad.ts';
        const source =
            'export { DatabaseRepository } from "../infrastructure/adapters/driven/persistence/database.repository.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/application/use-cases/nested/bad.usecase.ts', () => {
        const path = 'apps/server/src/notes/application/use-cases/nested/bad.usecase.ts';
        const source =
            'export * from "../../../infrastructure/adapters/driven/persistence/barrel.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/application/normalized.ts', () => {
        const path = 'apps/server/src/notes/application/normalized.ts';
        const source =
            'export * from "../infrastructure/adapters/driven/persistence/database.repository.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/domain/bad.ts', () => {
        const path = 'apps/server/src/notes/domain/bad.ts';
        const source =
            'export type { Repository } from "../application/ports/driven/repository.interface.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driving/web/controller.ts', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/controller.ts';
        const source = 'export * from "../../driven/persistence/database.repository.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driven/persistence/cross-feature.ts', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/persistence/cross-feature.ts';
        const source =
            'export * from "../../../../../identity/infrastructure/adapters/driven/persistence/user.repository.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/web/src/bad.ts', () => {
        const path = 'apps/web/src/bad.ts';
        const source = 'export * from "../../server/src/notes/domain/entities/note.entity.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in packages/contracts/src/bad.ts', () => {
        const path = 'packages/contracts/src/bad.ts';
        const source =
            'export * from "../../../apps/server/src/notes/domain/entities/note.entity.js";';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/application/framework.ts', () => {
        const path = 'apps/server/src/notes/application/framework.ts';
        const source = 'import type { Kysely } from "kysely"; export type Database = Kysely<{}>;';
        const rule = 'no-restricted-imports';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/domain/alias.ts', () => {
        const path = 'apps/server/src/notes/domain/alias.ts';
        const source = 'export * from "#server/notes/domain/note";';
        const rule = 'no-restricted-imports';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/infrastructure/adapters/driven/persistence/framework.ts', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/persistence/framework.ts';
        const source = 'export { Injectable } from "@nestjs/common";';
        const rule = 'no-restricted-imports';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/application/dynamic.ts', () => {
        const path = 'apps/server/src/notes/application/dynamic.ts';
        const source = 'export const load = (name: string) => import(name);';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects forbidden dependency in apps/server/src/notes/application/inline.ts', () => {
        const path = 'apps/server/src/notes/application/inline.ts';
        const source =
            'export type Port = import("./ports/driven/repository.interface.js").Repository;';
        const rule = 'architecture(boundaries)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('accepts one port interface in its matching file', () => {
        const path = 'apps/server/src/notes/application/ports/driven/note-repository.interface.ts';
        const source = 'export interface NoteRepository {}';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('does not apply the one-interface port rule outside application ports', () => {
        const path = 'apps/server/src/notes/domain/table-shapes.ts';
        const source = 'interface NoteRow {} interface NewNoteRow {}';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('rejects multiple port interfaces in one file', () => {
        const path = 'apps/server/src/notes/application/ports/driven/note-repository.interface.ts';
        const source = 'export interface NoteRepository {} export interface NoteWriter {}';
        const rule = 'architecture(file-conventions)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects a port filename that does not match its interface', () => {
        const path = 'apps/server/src/notes/application/ports/driven/note-repository.interface.ts';
        const source = 'export interface NoteWriter {}';
        const rule = 'architecture(file-conventions)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('accepts a use case with one public operation and private helpers', () => {
        const path = 'apps/server/src/notes/application/use-cases/get-note.usecase.ts';
        const source =
            'import type { GetNoteUseCase } from "../ports/driving/get-note-use-case.interface.js"; export class GetNote implements GetNoteUseCase { execute() {} private find() {} }';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('rejects a use case with multiple public operations', () => {
        const path =
            'apps/server/src/identity/application/use-cases/authenticate-session.usecase.ts';
        const source = 'export class AuthenticateSession { authenticate() {} renew() {} }';
        const rule = 'architecture(file-conventions)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('counts public callable fields as use-case operations', () => {
        const path = 'apps/server/src/notes/application/use-cases/get-note.usecase.ts';
        const source = 'export class GetNote { execute() {} run = () => {}; }';
        const rule = 'architecture(file-conventions)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects a use case without its required suffix', () => {
        const path = 'apps/server/src/notes/application/use-cases/get-note.ts';
        const source = 'export class GetNote { execute() {} }';
        const rule = 'architecture(file-conventions)';
        const input = { path, source };

        const result = lint(input.path, input.source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain(rule);
    });
    it('rejects service and infrastructure filenames without role suffixes', () => {
        const servicePath = 'apps/server/src/identity/application/services/account-loader.ts';
        const serviceSource = 'export class AccountLoader { load() {} }';
        const adapterPath =
            'apps/server/src/identity/infrastructure/adapters/driven/persistence/jwt-session-tokens.ts';
        const adapterSource = 'export class JwtSessionTokens { issue() {} }';
        const service = lint(servicePath, serviceSource);
        const adapter = lint(adapterPath, adapterSource);

        expect(service.status).not.toBe(0);
        expect(service.stdout + service.stderr).toContain('architecture(file-conventions)');
        expect(adapter.status).not.toBe(0);
        expect(adapter.stdout + adapter.stderr).toContain('architecture(file-conventions)');
    });
    it('enforces entity, controller, repository, helper, and utility suffixes', () => {
        const entity = lint('apps/server/src/notes/domain/note.ts', 'export class Note {}');
        const controller = lint(
            'apps/server/src/infrastructure/adapters/driving/web/health.ts',
            'export class HealthController {}',
        );
        const repository = lint(
            'apps/server/src/notes/infrastructure/adapters/driven/persistence/kysely-note.adapter.ts',
            'export class KyselyNoteRepository {}',
        );
        const helper = lint(
            'apps/server/src/shared/domain/actor.ts',
            'export interface Actor {} export function requireReady() {}',
        );
        const utility = lint('apps/web/src/shared/api.ts', 'export function request() {}');
        const rule = 'architecture(file-conventions)';

        expect(entity.stdout + entity.stderr).toContain(rule);
        expect(controller.stdout + controller.stderr).toContain(rule);
        expect(repository.stdout + repository.stderr).toContain(rule);
        expect(helper.stdout + helper.stderr).toContain(rule);
        expect(utility.stdout + utility.stderr).toContain(rule);
    });
});

describe('target hexagonal adapter boundaries', () => {
    it('allows NestJS decorators in driving web adapters', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driving/web/entry.controller.ts';
        const source =
            'import { Controller } from "@nestjs/common"; @Controller() export class EntryController {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('allows NestJS decorators in composition', () => {
        const path = 'apps/server/src/notes/infrastructure/config/entry.module.ts';
        const source =
            'import { Module } from "@nestjs/common"; @Module({}) export class EntryModule {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('rejects NestJS type imports in driven adapters', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/runtime/entry.adapter.ts';
        const source =
            'import type { OnModuleInit } from "@nestjs/common"; export type Hook = OnModuleInit;';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects decorators on driven adapters', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/persistence/decorated.adapter.ts';
        const source = '@Technical() export class Decorated {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects ORM decorators on domain entities', () => {
        const path = 'apps/server/src/notes/domain/entities/decorated.entity.ts';
        const source = '@Entity() export class Decorated {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects a driving adapter importing persistence', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/storage.ts';
        const source =
            'export { DatabaseRepository } from "../../driven/persistence/database.repository.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects a driving adapter importing concrete use cases', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/concrete.ts';
        const source =
            'export { ListNotes } from "../../../../application/use-cases/list-notes.usecase.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects a driven adapter importing a driving controller', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/persistence/entry.adapter.ts';
        const source = 'export { NotesController } from "../../driving/web/notes.controller.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects a driven adapter importing composition', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/persistence/config.adapter.ts';
        const source = 'export { configured } from "../../../config/notes.module.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects a driving adapter importing composition', () => {
        const path = 'apps/server/src/notes/infrastructure/adapters/driving/web/config.ts';
        const source = 'export { configured } from "../../../config/notes.module.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects cross-feature infrastructure access from composition', () => {
        const path = 'apps/server/src/notes/infrastructure/config/foreign.module.ts';
        const source =
            'export { UserRepository } from "../../../identity/infrastructure/adapters/driven/persistence/user.repository.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('accepts explicit cross-feature driving contracts', () => {
        const path = 'apps/server/src/notes/application/collaboration.ts';
        const source =
            'export type { AuthenticateUseCase } from "../../identity/application/ports/driving/authenticate-use-case.interface.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts shared driven runtime dependencies', () => {
        const path =
            'apps/server/src/notes/infrastructure/adapters/driven/runtime/clock.adapter.ts';
        const source =
            'export { SystemClock } from "../../../../../shared/infrastructure/adapters/driven/runtime/system-clock.adapter.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts desktop lifecycle access to root bootstrap', () => {
        const path = 'apps/desktop/src/backend.ts';
        const source =
            'export { startBackend } from "../../server/src/infrastructure/config/bootstrap.js";';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('accepts the root health controller in the driving boundary', () => {
        const path = 'apps/server/src/infrastructure/adapters/driving/web/health.controller.ts';
        const source =
            'import { Controller } from "@nestjs/common"; @Controller() export class HealthController {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
    });
    it('rejects legacy presentation locations', () => {
        const path = 'apps/server/src/notes/presentation/legacy.ts';
        const source = 'export const value = 1;';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects flat infrastructure locations', () => {
        const path = 'apps/server/src/notes/infrastructure/legacy.adapter.ts';
        const source = 'export class Legacy {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects unsplit application port directories', () => {
        const path = 'apps/server/src/notes/application/ports/legacy.interface.ts';
        const source = 'export interface Legacy {}';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects underscores in project folder names', () => {
        const path = 'apps/web/src/features/server_settings/types.ts';
        const source = 'export type Port = number;';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects a use case without a driving contract', () => {
        const path = 'apps/server/src/notes/application/use-cases/missing.usecase.ts';
        const source = 'export class Missing { execute() {} }';

        const result = lint(path, source);

        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).not.toBe(0);
        expect(result.stdout + result.stderr).not.toContain('Cannot resolve');
    });
    it('rejects camel-case project folder names', () => {
        const path = 'apps/web/src/features/serverSettings/types.ts';
        const source = 'export type Port = number;';

        const result = lint(path, source);

        expect(result.status).not.toBe(0);
        expect(result.stdout + result.stderr).toContain('architecture(boundaries)');
    });
});
