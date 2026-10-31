import { resolve } from 'node:path';

export interface DesktopConfiguration {
    host: string;
    httpPort: number | undefined;
    httpPortSource: 'command-line' | 'environment' | undefined;
    dataDirectory: string;
    recoveryLogin: string | null;
}

export class DesktopConfigurationParser {
    static parse(
        args: string[],
        environment: Record<string, string | undefined>,
        defaultDataDirectory: string
    ): DesktopConfiguration {
        const recovery = args.includes('--reset-admin');
        const recoveryLogin = this.value(args, '--login') ?? null;

        if (recovery && !recoveryLogin) {
            throw new Error('Use --reset-admin --login <administrator username>.');
        }

        const cliPort = this.value(args, '--http-port');
        const rawPort = cliPort ?? environment.APP_HTTP_PORT;
        const port = rawPort === undefined ? undefined : Number(rawPort);

        if (port !== undefined && (!Number.isInteger(port) || port < 1024 || port > 65535)) {
            throw new Error('HTTP port must be an integer between 1024 and 65535.');
        }

        return {
            host: this.value(args, '--host') ?? environment.APP_HOST ?? '0.0.0.0',
            httpPort: port,
            httpPortSource:
                cliPort !== undefined
                    ? 'command-line'
                    : rawPort !== undefined
                        ? 'environment'
                        : undefined,
            dataDirectory: resolve(
                this.value(args, '--data-dir') ?? environment.APP_DATA_DIR ?? defaultDataDirectory
            ),
            recoveryLogin: recovery ? recoveryLogin : null
        };
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
