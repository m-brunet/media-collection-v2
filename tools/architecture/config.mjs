export const architectureRules = {
    'architecture/boundaries': 'error',
    'architecture/file-conventions': 'error',
    'no-restricted-imports': [
        'error',
        {
            patterns: [
                {
                    regex: '^(#|@electron-base/)',
                    message: 'Use a relative path for first-party source imports.',
                },
            ],
        },
    ],
};

const pureImports = (test) => [
    'error',
    {
        patterns: [
            {
                group: ['*', '!./**', '!../**', ...(test ? ['!vitest'] : [])],
                message: 'Domain and application are pure TypeScript. Depend on application ports.',
            },
        ],
    },
];

export const architectureOverrides = [
    {
        files: ['apps/server/src/*/domain/**/*.ts', 'apps/server/src/*/application/**/*.ts'],
        rules: {
            'no-restricted-imports': pureImports(false),
            'no-restricted-globals': [
                'error',
                'process',
                'Buffer',
                '__dirname',
                '__filename',
                'fetch',
                'require',
            ],
        },
    },
    {
        files: [
            'apps/server/src/*/domain/**/*.spec.ts',
            'apps/server/src/*/application/**/*.spec.ts',
        ],
        rules: { 'no-restricted-imports': pureImports(true) },
    },
    {
        files: [
            'apps/server/src/**/infrastructure/adapters/driven/**/*.ts',
            'apps/server/src/infrastructure/adapters/driven/**/*.ts',
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        '@nestjs/**',
                        'electron',
                        'react',
                        'react/**',
                        'react-dom',
                        'react-dom/**',
                        '#*',
                        '@electron-base/**',
                    ],
                },
            ],
        },
    },
    {
        files: ['apps/web/src/**/*', 'packages/contracts/src/**/*'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        'node:*',
                        '@nestjs/**',
                        'electron',
                        'kysely',
                        'better-sqlite3',
                        '#*',
                        '@electron-base/**',
                    ],
                },
            ],
        },
    },
];
