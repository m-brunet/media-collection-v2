import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const exclude = ['node_modules/**', 'dist/**', '.cache/**', 'release/**', 'design/**'];

export default defineConfig({
    test: {
        testTimeout: 30_000,
        hookTimeout: 60_000,
        maxWorkers: 6,
        projects: [
            {
                extends: true,
                test: {
                    name: 'node',
                    include: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
                    exclude,
                },
            },
            {
                extends: true,
                plugins: [react()],
                test: {
                    name: 'web',
                    environment: 'jsdom',
                    include: ['apps/web/src/**/*.spec.tsx'],
                    exclude,
                    setupFiles: ['apps/web/src/test-setup.ts'],
                },
            },
        ],
    },
});
