import { defineConfig } from 'oxlint';
import { architectureOverrides, architectureRules } from './tools/architecture/config.mjs';

const variableDeclarations = ['const', 'let', 'var'];
const controlStatements = ['if', 'for', 'while', 'do', 'switch', 'try'];
const statementPadding = [
    { blankLine: 'always', prev: variableDeclarations, next: '*' },
    { blankLine: 'always', prev: '*', next: controlStatements },
    { blankLine: 'always', prev: controlStatements, next: '*' },
    { blankLine: 'always', prev: '*', next: 'return' },
];

export default defineConfig({
    plugins: ['typescript', 'react', 'import'],
    jsPlugins: [
        './tools/architecture/plugin.mjs',
        { name: '@stylistic', specifier: '@stylistic/eslint-plugin' },
    ],
    categories: { correctness: 'error' },
    rules: {
        ...architectureRules,
        curly: ['error', 'all'],
        '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: false }],
        '@stylistic/max-statements-per-line': ['error', { max: 1 }],
        '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 0 }],
        '@stylistic/padding-line-between-statements': [
            'error',
            ...statementPadding,
            { blankLine: 'never', prev: variableDeclarations, next: variableDeclarations },
        ],
        'typescript/no-explicit-any': 'error',
        'typescript/no-require-imports': 'error',
        'react-hooks/rules-of-hooks': 'error',
        'react-hooks/exhaustive-deps': 'error',
    },
    overrides: [
        ...architectureOverrides,
        {
            files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
            rules: {
                '@stylistic/padding-line-between-statements': [
                    'error',
                    ...statementPadding,
                    { blankLine: 'any', prev: variableDeclarations, next: variableDeclarations },
                ],
            },
        },
    ],
    ignorePatterns: ['dist/**', 'release/**', '.cache/**'],
});
