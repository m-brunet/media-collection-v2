import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { SourceFile } from './test-conventions.util.js';
import { TestConventions, helperSources, utilitySources } from './test-conventions.util.js';

function inventory(directory: string): SourceFile[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name).replaceAll('\\', '/');

        return entry.isDirectory()
            ? inventory(path)
            : [{ path, source: readFileSync(path, 'utf8') }];
    });
}

const utilities = utilitySources.flatMap((path) => [
    { path, source: 'export function utility() {}' },
    { path: path.replace('.ts', '.spec.ts'), source: '' },
]);
const helpers = helperSources.flatMap((path) => [
    { path, source: 'export function helper() {}' },
    { path: path.replace('.ts', '.spec.ts'), source: '' },
]);

it('enforces test pairing and use-case ownership throughout the project', () => {
    const files = [
        ...inventory('apps'),
        ...inventory('packages'),
        ...inventory('tests'),
        ...inventory('tools'),
    ];

    const issues = TestConventions.check(files);

    expect(issues).toEqual([]);
});

it('rejects missing API test', () => {
    const invalid = [
        {
            path: 'apps/server/src/infrastructure/adapters/driving/web/health.controller.ts',
            source: '',
        },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});
it('rejects misplaced API test', () => {
    const invalid = [
        {
            path: 'apps/server/src/infrastructure/adapters/driving/web/health.controller.ts',
            source: '',
        },
        { path: 'apps/server/src/wrong/health.controller.e2e-spec.ts', source: '' },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});
it('rejects misnamed API test', () => {
    const invalid = [
        {
            path: 'apps/server/src/infrastructure/adapters/driving/web/health.controller.ts',
            source: '',
        },
        {
            path: 'apps/server/src/infrastructure/adapters/driving/web/wrong.controller.e2e-spec.ts',
            source: '',
        },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});
it('rejects missing unit test', () => {
    const invalid = [
        {
            path: 'apps/server/src/notes/domain/entities/note.entity.ts',
            source: 'export class Note {}',
        },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});
it('rejects a missing helper unit test', () => {
    const missingTest = helperSources[0].replace(/\.ts$/, '.spec.ts');
    const files = [...utilities, ...helpers.filter((file) => file.path !== missingTest)];

    const issues = TestConventions.check(files);

    expect(issues).toContain('Missing unit test: ' + missingTest);
});
it('rejects misnamed unit test', () => {
    const invalid = [
        {
            path: 'apps/server/src/notes/domain/entities/note.entity.ts',
            source: 'export class Note {}',
        },
        { path: 'apps/server/src/notes/domain/wrong.spec.ts', source: '' },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});
it('rejects misplaced unit test', () => {
    const invalid = [
        {
            path: 'apps/server/src/notes/domain/entities/note.entity.ts',
            source: 'export class Note {}',
        },
        { path: 'apps/server/src/notes/domain/nested/note.entity.spec.ts', source: '' },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});
it('rejects grouped use cases', () => {
    const invalid = [
        {
            path: 'apps/server/src/notes/application/use-cases/notes.usecase.ts',
            source: 'export class First {} export class Second {}',
        },
        { path: 'apps/server/src/notes/application/use-cases/notes.usecase.spec.ts', source: '' },
    ];
    const files: SourceFile[] = [...utilities, ...invalid];

    const issues = TestConventions.check(files);

    expect(issues.length).toBeGreaterThan(0);
});

it('accepts matching files and behavior-free contracts', () => {
    const files = [
        ...utilities,
        ...helpers,
        {
            path: 'apps/server/src/infrastructure/adapters/driving/web/health.controller.ts',
            source: '',
        },
        {
            path: 'apps/server/src/infrastructure/adapters/driving/web/health.controller.e2e-spec.ts',
            source: '',
        },
        {
            path: 'apps/server/src/notes/domain/entities/note.entity.ts',
            source: 'export class Note {}',
        },
        { path: 'apps/server/src/notes/domain/entities/note.entity.spec.ts', source: '' },
        {
            path: 'apps/server/src/shared/application/ports/driven/clock.interface.ts',
            source: 'export interface Clock {}',
        },
    ];

    const issues = TestConventions.check(files);

    expect(issues).toEqual([]);
});

it('rejects stale utility inventory entries', () => {
    const files: SourceFile[] = [];

    const issues = TestConventions.check(files);

    expect(issues).toContain('Stale utility inventory: ' + utilitySources[0]);
});

it('rejects stale helper inventory entries', () => {
    const files: SourceFile[] = [];

    const issues = TestConventions.check(files);

    expect(issues).toContain('Stale helper inventory: ' + helperSources[0]);
});
