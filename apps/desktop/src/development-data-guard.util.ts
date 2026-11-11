import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface DevelopmentDataTarget {
    packaged: boolean;
    appPath: string;
    dataDirectory: string;
    dataDirectoryOverridden: boolean;
}

export class DevelopmentDataGuard {
    static readonly directoryName = '.dev-data';

    static ensure(target: DevelopmentDataTarget): string {
        if (target.packaged) {
            throw new Error(
                'Development data commands only run from the repository (npm run), never from an installed application.',
            );
        }

        if (target.dataDirectoryOverridden) {
            throw new Error(
                'Development data commands always use ' +
                    DevelopmentDataGuard.directoryName +
                    '; remove --data-dir and APP_DATA_DIR.',
            );
        }

        const repository = resolve(target.appPath);
        const expected = join(repository, DevelopmentDataGuard.directoryName);

        if (resolve(target.dataDirectory) !== expected) {
            throw new Error('Development data commands only use ' + expected + '.');
        }

        if (!existsSync(expected)) {
            throw new Error(
                'No development data yet: start the application with npm run dev and complete the setup first.',
            );
        }

        const entry = lstatSync(expected);

        if (entry.isSymbolicLink() || !entry.isDirectory()) {
            throw new Error(expected + ' must be a plain directory, not a link.');
        }

        if (
            realpathSync(expected) !==
            join(realpathSync(repository), DevelopmentDataGuard.directoryName)
        ) {
            throw new Error(expected + ' resolves outside the repository.');
        }

        return expected;
    }
}
