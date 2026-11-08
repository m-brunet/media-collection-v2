import { realpathSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { ResolverFactory } from 'oxc-resolver';

const resolver = new ResolverFactory({
    extensions: ['.ts', '.tsx', '.js', '.mjs', '.cts', '.cjs', '.json', '.css'],
    extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.jsx': ['.tsx', '.jsx'],
        '.cjs': ['.cts', '.cjs'],
    },
    conditionNames: ['node', 'import'],
    symlinks: true,
});

function classify(root, file) {
    const path = relative(root, file).replaceAll('\\', '/');
    const backend = /^apps\/server\/src\/(.+)$/.exec(path);

    if (backend) {
        const rootInfrastructure = backend[1].startsWith('infrastructure/');
        const parts = backend[1].split('/');
        const feature = rootInfrastructure ? '$root' : parts.shift();
        const layerPath = parts.join('/');
        const layer =
            /^(domain|application)\//.exec(layerPath)?.[1] ??
            /^infrastructure\/adapters\/(driving|driven)\//.exec(layerPath)?.[1] ??
            (layerPath.startsWith('infrastructure/config/') ? 'config' : 'invalid');

        return {
            area: 'server',
            feature,
            layer,
            path,
            test: path.endsWith('.spec.ts') || path.endsWith('.e2e-spec.ts'),
            composition: layer === 'config',
        };
    }

    for (const [prefix, area] of [
        ['apps/web/src/', 'web'],
        ['apps/desktop/src/', 'desktop'],
        ['packages/contracts/src/', 'contracts'],
    ]) {
        if (path.startsWith(prefix)) {
            return { area, path };
        }
    }

    return { area: 'other', path };
}

function isMigration(path) {
    return /^apps\/server\/src\/shared\/infrastructure\/adapters\/driven\/persistence\/migrations\/[0-9]{3}-[a-z0-9-]+\.ts$/.test(
        path,
    );
}

function permitted(from, to) {
    if (from.layer === 'invalid' || to.layer === 'invalid') {
        return false;
    }

    if (from.area === 'other') {
        return true;
    }

    if (from.test && from.layer === 'driving' && to.path.startsWith('tests/api/')) {
        return true;
    }

    if (from.area === 'web') {
        return ['web', 'contracts'].includes(to.area);
    }

    if (from.area === 'contracts') {
        return to.area === 'contracts';
    }

    if (from.area === 'desktop') {
        return (
            ['desktop', 'contracts'].includes(to.area) ||
            (to.area === 'server' &&
                to.feature === '$root' &&
                to.composition &&
                /\/(bootstrap|maintenance|development-data)\.ts$/.test(to.path))
        );
    }

    if (to.area === 'contracts') {
        return from.layer === 'driving' || from.composition;
    }

    if (to.area !== 'server') {
        return false;
    }

    const same = from.feature === to.feature;
    const shared = to.feature === 'shared';
    const port = /\/application\/ports\/(driving|driven)\/[^/]+\.interface\.ts$/.test(to.path);
    const inner = ['domain', 'application'].includes(to.layer);

    if (from.composition) {
        return from.feature === '$root' || same || shared || port;
    }

    if (from.layer === 'domain') {
        return (same || shared) && to.layer === 'domain';
    }

    if (from.layer === 'application') {
        return ((same || shared) && inner) || port;
    }

    if (from.layer === 'driving') {
        return (
            (((same || shared) && (inner || to.layer === 'driving')) || port) &&
            !to.path.includes('/application/use-cases/')
        );
    }

    if (from.layer === 'driven') {
        return ((same || shared) && (inner || to.layer === 'driven')) || port;
    }

    return false;
}

const namedFileRoles = new Map([
    ['apps/server/src/shared/domain/actor', 'helper'],
    ['apps/desktop/src/configuration', 'util'],
    ['apps/web/src/shared/api', 'util'],
    ['tools/architecture/test-conventions', 'util'],
]);

function fileStem(path) {
    return path
        .replace(
            /\.(?:interface|service|repository|adapter|helper|entity|util|controller|usecase)\.ts$/,
            '',
        )
        .replace(/\.ts$/, '');
}

function kebabCase(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
        .toLowerCase();
}

function topLevelDeclarations(program) {
    return program.body.flatMap((statement) => {
        if (
            (statement.type === 'ExportNamedDeclaration' ||
                statement.type === 'ExportDefaultDeclaration') &&
            statement.declaration
        ) {
            return [statement.declaration];
        }

        return [statement];
    });
}

function walkAst(node, visit) {
    if (!node || typeof node !== 'object') {
        return;
    }

    if (Array.isArray(node)) {
        for (const child of node) {
            walkAst(child, visit);
        }

        return;
    }

    if (typeof node.type === 'string') {
        visit(node);
    }

    for (const [key, value] of Object.entries(node)) {
        if (key !== 'parent' && key !== 'tokens' && key !== 'comments') {
            walkAst(value, visit);
        }
    }
}

function publicBusinessMethods(classDeclaration) {
    return (classDeclaration.body?.body ?? []).filter((member) => {
        if (member.type === 'PropertyDefinition') {
            return (
                !member.static &&
                !['private', 'protected'].includes(member.accessibility) &&
                member.key?.type !== 'PrivateIdentifier' &&
                ['ArrowFunctionExpression', 'FunctionExpression'].includes(member.value?.type)
            );
        }

        if (
            !['MethodDefinition', 'TSAbstractMethodDefinition'].includes(member.type) ||
            member.kind !== 'method' ||
            member.static
        ) {
            return false;
        }

        return !['private', 'protected'].includes(member.accessibility);
    });
}

export default {
    meta: { name: 'architecture' },
    rules: {
        'file-conventions': {
            meta: {
                type: 'problem',
                schema: [],
                messages: {
                    portCount: 'Each application port file must declare exactly one interface.',
                    portLocation: 'Application ports belong in ports/driving or ports/driven.',
                    useCasePort:
                        'Each use case must implement an imported application driving interface.',
                    portName: 'Port interface {{name}} must be in {{file}}.',
                    useCaseSuffix: 'Use-case source files must end in .usecase.ts.',
                    useCaseOperation: 'A use-case class must expose exactly one public operation.',
                    serviceSuffix: 'Service source files must end in .service.ts.',
                    repositorySuffix: 'Repository implementations must end in .repository.ts.',
                    adapterSuffix: 'Infrastructure adapters must end in .adapter.ts.',
                    helperSuffix: 'Helper modules must end in .helper.ts.',
                    utilitySuffix: 'Utility modules must end in .util.ts.',
                    entitySuffix: 'Entity files must end in .entity.ts.',
                    controllerSuffix: 'Controller files must end in .controller.ts.',
                },
            },
            create(context) {
                const root = resolve(context.settings?.architecture?.root ?? process.cwd());
                const filename = context.filename ?? context.getFilename();
                const from = classify(root, filename);

                return {
                    Program(program) {
                        if (from.area === 'other' || from.test || !from.path.endsWith('.ts')) {
                            return;
                        }

                        const declarations = topLevelDeclarations(program);
                        const classes = declarations.filter((node) =>
                            ['ClassDeclaration', 'ClassExpression'].includes(node.type),
                        );

                        if (from.path.includes('/application/ports/')) {
                            if (!/\/application\/ports\/(driving|driven)\/[^/]+$/.test(from.path)) {
                                context.report({ node: program, messageId: 'portLocation' });
                            }

                            const interfaces = [];

                            walkAst(program, (node) => {
                                if (node.type === 'TSInterfaceDeclaration') {
                                    interfaces.push(node);
                                }
                            });

                            if (interfaces.length !== 1) {
                                context.report({ node: program, messageId: 'portCount' });
                            }

                            for (const declaration of interfaces) {
                                const name = declaration.id?.name ?? '';
                                const expected = kebabCase(name) + '.interface.ts';

                                if (!from.path.endsWith('/' + expected)) {
                                    context.report({
                                        node: declaration,
                                        messageId: 'portName',
                                        data: { name, file: expected },
                                    });
                                }
                            }
                        }

                        if (
                            from.path.includes('/application/use-cases/') &&
                            !from.path.endsWith('.usecase.ts')
                        ) {
                            context.report({ node: program, messageId: 'useCaseSuffix' });
                        }

                        if (
                            from.path.includes('/application/use-cases/') &&
                            from.path.endsWith('.usecase.ts')
                        ) {
                            const drivingImports = new Set();

                            for (const statement of program.body) {
                                if (statement.type !== 'ImportDeclaration') {
                                    continue;
                                }

                                const destination = resolver.sync(
                                    dirname(filename),
                                    statement.source.value,
                                ).path;

                                if (
                                    destination &&
                                    realpathSync(destination)
                                        .replaceAll('\\', '/')
                                        .includes('/application/ports/driving/')
                                ) {
                                    for (const specifier of statement.specifiers) {
                                        drivingImports.add(specifier.local.name);
                                    }
                                }
                            }

                            for (const declaration of classes) {
                                if (
                                    !(declaration.implements ?? []).some((contract) =>
                                        drivingImports.has(contract.expression?.name),
                                    )
                                ) {
                                    context.report({ node: declaration, messageId: 'useCasePort' });
                                }

                                if (publicBusinessMethods(declaration).length !== 1) {
                                    context.report({
                                        node: declaration,
                                        messageId: 'useCaseOperation',
                                    });
                                }
                            }
                        }

                        if (
                            from.path.includes('/application/services/') &&
                            !from.path.endsWith('.service.ts')
                        ) {
                            context.report({ node: program, messageId: 'serviceSuffix' });
                        }

                        if (
                            from.layer === 'driven' &&
                            from.path.startsWith('apps/server/src/') &&
                            !isMigration(from.path)
                        ) {
                            for (const declaration of classes) {
                                const role = declaration.id?.name?.endsWith('Repository')
                                    ? 'repository'
                                    : declaration.id?.name?.endsWith('Helper')
                                      ? 'helper'
                                      : 'adapter';

                                if (!from.path.endsWith('.' + role + '.ts')) {
                                    context.report({
                                        node: declaration,
                                        messageId:
                                            role === 'repository'
                                                ? 'repositorySuffix'
                                                : role === 'helper'
                                                  ? 'helperSuffix'
                                                  : 'adapterSuffix',
                                    });
                                }
                            }
                        }

                        for (const declaration of classes) {
                            const name = declaration.id?.name ?? '';

                            if (
                                name.endsWith('Controller') &&
                                !from.path.endsWith('.controller.ts')
                            ) {
                                context.report({
                                    node: declaration,
                                    messageId: 'controllerSuffix',
                                });
                            } else if (
                                ['HttpSessions', 'LoginLimiter'].includes(name) &&
                                !from.path.endsWith('.service.ts')
                            ) {
                                context.report({ node: declaration, messageId: 'serviceSuffix' });
                            } else if (
                                ['User'].includes(name) &&
                                from.layer === 'domain' &&
                                !from.path.endsWith('.entity.ts')
                            ) {
                                context.report({ node: declaration, messageId: 'entitySuffix' });
                            } else if (
                                name === 'BackendProcess' &&
                                !from.path.endsWith('.adapter.ts')
                            ) {
                                context.report({ node: declaration, messageId: 'adapterSuffix' });
                            }
                        }

                        const role = namedFileRoles.get(fileStem(from.path));

                        if (role && !from.path.endsWith('.' + role + '.ts')) {
                            context.report({
                                node: program,
                                messageId: role === 'helper' ? 'helperSuffix' : 'utilitySuffix',
                            });
                        }
                    },
                };
            },
        },
        'persistence-sql': {
            meta: {
                type: 'problem',
                schema: [],
                messages: {
                    raw: 'Use Kysely builders. Raw SQL is permitted only in database migrations.',
                    driver: 'Direct SQLite driver access is restricted to database connection setup.',
                    migration:
                        'Runtime adapters must not import migrations; only DatabaseMigrations loads them.',
                },
            },
            create(context) {
                const root = context.cwd ?? context.getCwd();
                const file = context.filename ?? context.getFilename();
                const from = classify(root, file);

                if (from.area !== 'server' || from.test || isMigration(from.path)) {
                    return {};
                }

                const database =
                    from.path ===
                    'apps/server/src/shared/infrastructure/adapters/driven/persistence/database.adapter.ts';
                const provider =
                    from.path ===
                    'apps/server/src/shared/infrastructure/adapters/driven/persistence/database-migrations.adapter.ts';

                function imports(node) {
                    const source = node.source?.value;

                    if (!source) {
                        return;
                    }

                    if (source === 'kysely' || source.startsWith('kysely/')) {
                        for (const specifier of node.specifiers ?? []) {
                            const name = specifier.imported?.name ?? specifier.local?.name;

                            if (
                                specifier.type === 'ImportNamespaceSpecifier' ||
                                specifier.type === 'ExportNamespaceSpecifier' ||
                                node.type === 'ExportAllDeclaration' ||
                                ['sql', 'CompiledQuery', 'RawBuilder', 'RawNode'].includes(name)
                            ) {
                                context.report({ node, messageId: 'raw' });
                                break;
                            }
                        }

                        if (node.type === 'ExportAllDeclaration') {
                            context.report({ node, messageId: 'raw' });
                        }
                    }

                    if (
                        /^(better-sqlite3|sqlite3|sqlite)(?:\/|$)|^node:sqlite$/.test(source) &&
                        !database
                    ) {
                        context.report({ node, messageId: 'driver' });
                    }

                    if (source.startsWith('.')) {
                        const target = resolver.sync(dirname(file), source).path;

                        if (
                            target &&
                            ((isMigration(relative(root, target).replaceAll('\\', '/')) &&
                                !provider) ||
                                (relative(root, target).replaceAll('\\', '/') ===
                                    'apps/server/src/shared/infrastructure/adapters/driven/persistence/database-migrations.adapter.ts' &&
                                    !database))
                        ) {
                            context.report({ node, messageId: 'migration' });
                        }
                    }
                }

                return {
                    ImportDeclaration: imports,
                    ExportNamedDeclaration: imports,
                    ExportAllDeclaration: imports,
                    CallExpression(node) {
                        const property = node.callee?.property;
                        const name = property?.name ?? property?.value;

                        if (
                            ['executeQuery', 'prepare', 'exec'].includes(name) ||
                            (name === 'pragma' &&
                                (!database ||
                                    ![
                                        'foreign_keys = ON',
                                        'journal_mode = WAL',
                                        'busy_timeout = 5000',
                                    ].includes(node.arguments[0]?.value)))
                        ) {
                            context.report({ node, messageId: 'driver' });
                        }
                    },
                };
            },
        },
        // Backend code is object-oriented: behavior lives in classes (static methods for stateless
        // utilities), never in standalone functions. Test files may keep small local helpers;
        // NestJS decorator factories (PascalCase, for example `Access`) are functions by nature.
        'backend-classes': {
            meta: {
                type: 'problem',
                schema: [],
                messages: {
                    standalone:
                        'Backend code is object-oriented: move {{name}} into a class (a private method of its owner, or a static method of a focused class).',
                },
            },
            create(context) {
                const root = resolve(context.settings?.architecture?.root ?? process.cwd());
                const filename = context.filename ?? context.getFilename();
                const path = relative(root, filename).replaceAll('\\', '/');
                const checked =
                    /^(apps\/server\/src|tests\/api)\//.test(path) &&
                    /\.ts$/.test(path) &&
                    !/\.(e2e-)?spec\.ts$/.test(path);

                function inspect(declaration) {
                    if (declaration?.type === 'FunctionDeclaration' && declaration.id) {
                        context.report({
                            node: declaration,
                            messageId: 'standalone',
                            data: { name: declaration.id.name },
                        });
                    }

                    if (declaration?.type === 'VariableDeclaration') {
                        for (const variable of declaration.declarations) {
                            const name = variable.id?.name ?? '';
                            const callable = [
                                'ArrowFunctionExpression',
                                'FunctionExpression',
                            ].includes(variable.init?.type);

                            if (callable && !/^[A-Z]/.test(name)) {
                                context.report({
                                    node: variable,
                                    messageId: 'standalone',
                                    data: { name },
                                });
                            }
                        }
                    }
                }

                return {
                    Program(node) {
                        if (!checked) {
                            return;
                        }

                        for (const statement of node.body) {
                            inspect(
                                ['ExportNamedDeclaration', 'ExportDefaultDeclaration'].includes(
                                    statement.type,
                                )
                                    ? statement.declaration
                                    : statement,
                            );
                        }
                    },
                };
            },
        },
        boundaries: {
            meta: {
                type: 'problem',
                schema: [],
                messages: {
                    forbidden:
                        'Architecture violation: {{from}} cannot depend on {{to}}. Use an application port and compose in a Nest module.',
                    unresolved:
                        'Cannot resolve first-party import {{source}}; architecture checks require a real destination.',
                    static: 'Backend imports must be static declarations; use import or import type.',
                    decorator:
                        'Decorators and NestJS imports belong only in driving adapters or infrastructure/config.',
                    relative:
                        'Source imports must use relative paths; absolute paths and file URLs are forbidden.',
                    persistence:
                        'Database libraries belong in driven adapters or config; driving adapters consume application contracts.',
                    layout: 'Backend source must belong to domain/application, infrastructure/adapters/driving or driven, or infrastructure/config.',
                    folderName:
                        'Project folder names must use dashes between words, never underscores.',
                },
            },
            create(context) {
                const root = resolve(context.settings?.architecture?.root ?? process.cwd());
                const filename = context.filename ?? context.getFilename();
                const from = classify(root, filename);

                function check(node, source) {
                    if (
                        from.area === 'server' &&
                        source?.startsWith('@nestjs/') &&
                        !['driving', 'config'].includes(from.layer)
                    ) {
                        context.report({ node, messageId: 'decorator' });

                        return;
                    }

                    if (
                        from.area === 'server' &&
                        from.layer === 'driving' &&
                        /^(?:kysely|better-sqlite3|sqlite3|sqlite)(?:\/|$)|^node:sqlite$/.test(
                            source ?? '',
                        )
                    ) {
                        context.report({ node, messageId: 'persistence' });

                        return;
                    }

                    if (
                        from.area !== 'other' &&
                        source &&
                        (source.startsWith('file:') ||
                            source.startsWith('/') ||
                            /^[A-Za-z]:[\\/]/.test(source))
                    ) {
                        context.report({ node, messageId: 'relative' });

                        return;
                    }

                    if (!source || (!source.startsWith('.') && !source.startsWith('/'))) {
                        return;
                    }

                    const result = resolver.sync(dirname(filename), source);

                    if (!result.path) {
                        context.report({ node, messageId: 'unresolved', data: { source } });

                        return;
                    }

                    const to = classify(root, realpathSync(result.path));

                    if (!permitted(from, to)) {
                        context.report({
                            node,
                            messageId: 'forbidden',
                            data: { from: from.path, to: to.path },
                        });
                    }
                }

                function staticOnly(node) {
                    if (from.area === 'server') {
                        context.report({ node, messageId: 'static' });
                    }
                }

                return {
                    Program(node) {
                        if (
                            /^(apps|packages|tests|tools)\//.test(from.path) &&
                            from.path
                                .split('/')
                                .slice(0, -1)
                                .some((part) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(part))
                        ) {
                            context.report({ node, messageId: 'folderName' });
                        }

                        if (from.layer === 'invalid') {
                            context.report({ node, messageId: 'layout' });
                        }
                    },
                    ImportDeclaration(node) {
                        check(node, node.source.value);
                    },
                    ExportNamedDeclaration(node) {
                        check(node, node.source?.value);
                    },
                    ExportAllDeclaration(node) {
                        check(node, node.source.value);
                    },
                    ImportExpression: staticOnly,
                    TSImportType: staticOnly,
                    TSImportEqualsDeclaration: staticOnly,
                    Decorator(node) {
                        if (from.area === 'server' && !['driving', 'config'].includes(from.layer)) {
                            context.report({ node, messageId: 'decorator' });
                        }
                    },
                };
            },
        },
    },
};
