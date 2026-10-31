import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [ '**/*.spec.ts', '**/*.e2e-spec.ts' ],
        exclude: [ 'node_modules/**', 'dist/**', '.cache/**', 'release/**' ],
        testTimeout: 30_000,
        hookTimeout: 60_000,
        maxWorkers: 2
    }
});
