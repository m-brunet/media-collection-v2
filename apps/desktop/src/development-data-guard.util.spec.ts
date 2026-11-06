import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DevelopmentDataGuard } from './development-data-guard.util.js';

describe('DevelopmentDataGuard', () => {
    let repository: string;
    let production: string;

    beforeEach(() => {
        repository = mkdtempSync(join(tmpdir(), 'mc-repository-'));
        production = mkdtempSync(join(tmpdir(), 'mc-production-'));
    });
    afterEach(() => {
        rmSync(repository, { recursive: true, force: true });
        rmSync(production, { recursive: true, force: true });
    });

    function target(overrides: Partial<Parameters<typeof DevelopmentDataGuard.ensure>[0]> = {}) {
        return {
            packaged: false,
            appPath: repository,
            dataDirectory: join(repository, '.dev-data'),
            dataDirectoryOverridden: false,
            ...overrides,
        };
    }

    it('accepts the repository development data directory', () => {
        mkdirSync(join(repository, '.dev-data'));

        const result = DevelopmentDataGuard.ensure(target());

        expect(result).toBe(join(repository, '.dev-data'));
    });
    it('refuses an installed application', () => {
        mkdirSync(join(repository, '.dev-data'));
        const packaged = target({ packaged: true, dataDirectory: production });

        const operation = () => DevelopmentDataGuard.ensure(packaged);

        expect(operation).toThrow('never from an installed application');
    });
    it('refuses a data directory chosen on the command line or in the environment', () => {
        mkdirSync(join(repository, '.dev-data'));
        const overridden = target({ dataDirectory: production, dataDirectoryOverridden: true });

        const operation = () => DevelopmentDataGuard.ensure(overridden);

        expect(operation).toThrow('remove --data-dir and APP_DATA_DIR');
    });
    it('refuses any other directory', () => {
        const elsewhere = target({ dataDirectory: production });

        const operation = () => DevelopmentDataGuard.ensure(elsewhere);

        expect(operation).toThrow('only use');
    });
    it('refuses before any development data exists', () => {
        const missing = target();

        const operation = () => DevelopmentDataGuard.ensure(missing);

        expect(operation).toThrow('No development data yet');
    });
    it('refuses a development data directory that links elsewhere', () => {
        // A junction needs no privilege on Windows and is a symbolic link elsewhere.
        symlinkSync(production, join(repository, '.dev-data'), 'junction');
        const linked = target();

        const operation = () => DevelopmentDataGuard.ensure(linked);

        expect(operation).toThrow(/link|outside/);
    });
});
