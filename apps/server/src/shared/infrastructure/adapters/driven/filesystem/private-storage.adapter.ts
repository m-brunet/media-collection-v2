import { chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { win32 } from 'node:path';

// Protect application-owned files/directories: owner, SYSTEM and administrators on Windows.
export class PrivateStorage {
    private currentSid: string | undefined;

    restrict(path: string, directory = false): void {
        if (process.platform !== 'win32') {
            chmodSync(path, directory ? 0o700 : 0o600);

            return;
        }

        const sid = this.accountSid();
        const permission = directory ? ':(OI)(CI)F' : ':F';
        const options = { windowsHide: true, stdio: 'ignore' as const };

        execFileSync(PrivateStorage.systemTool('icacls.exe'), [path, '/reset'], options);
        execFileSync(
            PrivateStorage.systemTool('icacls.exe'),
            [
                path,
                '/inheritance:r',
                '/grant:r',
                '*' + sid + permission,
                '*S-1-5-18' + permission,
                '*S-1-5-32-544' + permission,
            ],
            options,
        );
    }

    private accountSid(): string {
        if (!this.currentSid) {
            const output = execFileSync(
                PrivateStorage.systemTool('whoami.exe'),
                ['/user', '/fo', 'csv', '/nh'],
                {
                    encoding: 'utf8',
                    windowsHide: true,
                },
            );
            const sid = output.trim().split(',').at(-1)?.replaceAll('"', '');

            if (!sid || !/^S-1-\d+(?:-\d+)+$/.test(sid)) {
                throw new Error(
                    'Could not identify the Windows account for private storage permissions.',
                );
            }

            this.currentSid = sid;
        }

        return this.currentSid;
    }

    // Resolve Windows tools from System32 so same-named tools earlier on PATH (for example Git Bash's
    // GNU whoami) are never used, whichever shell started the application.
    private static systemTool(name: string): string {
        return win32.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', name);
    }
}
