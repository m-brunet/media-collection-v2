import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

export interface ConfigurationFileValues {
    host?: string;
    httpPort?: number;
    dataDirectory?: string;
}

const schema = z.strictObject({
    host: z.string().trim().min(1, 'must be a non-empty address').optional(),
    httpPort: z
        .number('must be a whole number between 1024 and 65535')
        .int('must be a whole number between 1024 and 65535')
        .min(1024, 'must be a whole number between 1024 and 65535')
        .max(65535, 'must be a whole number between 1024 and 65535')
        .optional(),
    dataDirectory: z.string().trim().min(1, 'must be a non-empty folder path').optional(),
});

export class ConfigurationFile {
    constructor(readonly path: string) {}

    read(): ConfigurationFileValues {
        const text = this.text();

        if (text === undefined) {
            return {};
        }

        let value: unknown;

        try {
            value = JSON.parse(text.replace(/^﻿/, ''));
        } catch (error) {
            throw new Error(
                this.path +
                    ' is not valid JSON (' +
                    (error instanceof Error ? error.message : String(error)) +
                    ').',
                { cause: error },
            );
        }

        const parsed = schema.safeParse(value);

        if (!parsed.success) {
            const [issue] = parsed.error.issues;
            const problem =
                issue === undefined
                    ? 'is not a valid configuration'
                    : issue.code === 'unrecognized_keys'
                      ? 'unknown setting "' + issue.keys.join('", "') + '"'
                      : issue.path.length
                        ? issue.path.join('.') + ' ' + issue.message
                        : 'must contain a JSON object';

            throw new Error(this.path + ': ' + problem + '.');
        }

        const { dataDirectory, ...values } = parsed.data;

        return dataDirectory === undefined
            ? values
            : { ...values, dataDirectory: resolve(dirname(this.path), dataDirectory) };
    }

    ensure(): void {
        if (existsSync(this.path)) {
            return;
        }

        mkdirSync(dirname(this.path), { recursive: true });
        writeFileSync(this.path, '{}\n', { flag: 'wx' });
    }

    private text(): string | undefined {
        try {
            return readFileSync(this.path, 'utf8');
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                return undefined;
            }

            throw new Error(
                this.path +
                    ' could not be read (' +
                    (error instanceof Error ? error.message : String(error)) +
                    ').',
                { cause: error },
            );
        }
    }
}
