import { resolve } from 'node:path';
import type { ConfigurationFileValues } from './configuration-file.adapter.js';

export type PortSource = 'command-line' | 'environment' | 'config-file';

export interface DefaultPorts {
    http: number;
    https: number;
}

export interface DesktopConfiguration {
    host: string;
    httpPort: number | undefined;
    httpPortSource: PortSource | undefined;
    dataDirectory: string;
    dataDirectoryOverridden: boolean;
    localMaintenance: boolean;
    maintenance: DevelopmentMaintenance | null;
}

export type DevelopmentMaintenance = { type: 'reset' } | { type: 'import-v1'; source: string };

export class DesktopConfigurationParser {
    static parse(
        args: string[],
        environment: Record<string, string | undefined>,
        defaultDataDirectory: string,
        file: ConfigurationFileValues = {},
    ): DesktopConfiguration {
        const localMaintenance = args.includes('--maintenance');
        const maintenance = this.maintenance(args);

        if (maintenance && localMaintenance) {
            throw new Error('Run local maintenance and development data commands separately.');
        }

        const chosenDirectory =
            this.value(args, '--data-dir') ?? environment.APP_DATA_DIR ?? file.dataDirectory;
        const cliPort = this.value(args, '--http-port');
        const rawPort = cliPort ?? environment.APP_HTTP_PORT;
        const port = rawPort === undefined ? file.httpPort : Number(rawPort);

        if (port !== undefined && (!Number.isInteger(port) || port < 1024 || port > 65535)) {
            throw new Error('HTTP port must be an integer between 1024 and 65535.');
        }

        return {
            host: this.value(args, '--host') ?? environment.APP_HOST ?? file.host ?? '0.0.0.0',
            httpPort: port,
            httpPortSource:
                cliPort !== undefined
                    ? 'command-line'
                    : rawPort !== undefined
                      ? 'environment'
                      : port !== undefined
                        ? 'config-file'
                        : undefined,
            dataDirectory: resolve(chosenDirectory ?? defaultDataDirectory),
            dataDirectoryOverridden: chosenDirectory !== undefined,
            localMaintenance,
            maintenance,
        };
    }

    static configurationPath(
        args: string[],
        environment: Record<string, string | undefined>,
        defaultPath: string,
    ): string {
        return resolve(this.value(args, '--config') ?? environment.APP_CONFIG ?? defaultPath);
    }

    static defaultPorts(packaged: boolean): DefaultPorts {
        return packaged ? { http: 34345, https: 34443 } : { http: 34346, https: 34444 };
    }

    private static maintenance(args: string[]): DevelopmentMaintenance | null {
        const reset = args.includes('--dev-reset-data');
        const source = args.includes('--dev-import-v1')
            ? this.value(args, '--dev-import-v1')
            : undefined;

        if (reset && source !== undefined) {
            throw new Error('Choose either --dev-reset-data or --dev-import-v1 <books.json>.');
        }

        if (source !== undefined) {
            return { type: 'import-v1', source: resolve(source) };
        }

        return reset ? { type: 'reset' } : null;
    }

    private static value(args: string[], flag: string): string | undefined {
        const index = args.indexOf(flag);

        if (index < 0) {
            return undefined;
        }

        const next = args[index + 1];

        if (!next || next.startsWith('--')) {
            throw new Error('Supply a value after ' + flag + '.');
        }

        return next;
    }
}
