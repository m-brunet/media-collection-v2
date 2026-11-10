import { readFileSync } from 'node:fs';

// The running application's version: the root package.json is its single source.
export const appVersion: string = (
    JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
        version: string;
    }
).version;
