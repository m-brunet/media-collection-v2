export interface SourceFile {
    path: string;
    source: string;
}

// Utility ownership is explicit when it cannot be inferred from a feature layer.
export const utilitySources = [
    'apps/desktop/src/configuration.util.ts',
    'apps/web/src/shared/api.util.ts',
    'tools/architecture/test-conventions.util.ts',
];

export const helperSources = ['apps/server/src/shared/domain/actor.helper.ts'];

export class TestConventions {
    static check(files: readonly SourceFile[]): string[] {
        const paths = new Set(files.map((file) => file.path));
        const issues: string[] = [];

        for (const utility of utilitySources) {
            if (!paths.has(utility)) {
                issues.push('Stale utility inventory: ' + utility);
            }

            if (!utility.endsWith('.util.ts')) {
                issues.push('Utility file must use the .util.ts suffix: ' + utility);
            }
        }

        for (const helper of helperSources) {
            if (!paths.has(helper)) {
                issues.push('Stale helper inventory: ' + helper);
            }

            if (!helper.endsWith('.helper.ts')) {
                issues.push('Helper file must use the .helper.ts suffix: ' + helper);
            }
        }

        for (const { path, source } of files) {
            if (!path.endsWith('.ts') || path.endsWith('.d.ts')) {
                continue;
            }

            const core = /\/domain\/|\/application\/(?:use-cases|services)\//.test(path);

            if (path.endsWith('.spec.ts')) {
                if (
                    (core ||
                        utilitySources.includes(path.replace(/\.spec\.ts$/, '.ts')) ||
                        helperSources.includes(path.replace(/\.spec\.ts$/, '.ts'))) &&
                    !paths.has(path.replace(/\.spec\.ts$/, '.ts'))
                ) {
                    issues.push('Unit test has no same-directory matching source: ' + path);
                }

                continue;
            }

            if (path.endsWith('.e2e-spec.ts')) {
                if (
                    (path.startsWith('apps/') || path.endsWith('.controller.e2e-spec.ts')) &&
                    !paths.has(path.replace(/\.e2e-spec\.ts$/, '.ts'))
                ) {
                    issues.push(
                        'Controller API test has no same-directory matching controller: ' + path,
                    );
                }

                continue;
            }

            if (path.endsWith('.controller.ts')) {
                const expected = path.replace(/\.ts$/, '.e2e-spec.ts');

                if (!paths.has(expected)) {
                    issues.push('Missing controller API test: ' + expected);
                }
            }

            const utilityDirectory = /\/(?:utilities|utils|helpers)\//.test(path);
            const executable =
                /export\s+(?:async\s+)?(?:class|function)\s/.test(source) ||
                /export\s+const\s+\w+\s*=\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/.test(source);

            if (
                (core ||
                    utilityDirectory ||
                    utilitySources.includes(path) ||
                    helperSources.includes(path)) &&
                executable
            ) {
                const expected = path.replace(/\.ts$/, '.spec.ts');

                if (!paths.has(expected)) {
                    issues.push('Missing unit test: ' + expected);
                }
            }

            if (path.includes('/application/use-cases/') && !path.includes('/testing/')) {
                const classes = [...source.matchAll(/export\s+class\s+\w+/g)];

                if (classes.length !== 1) {
                    issues.push('Use-case file must export one use-case class: ' + path);
                }
            }
        }

        return issues;
    }
}
