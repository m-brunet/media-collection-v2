import { spawn } from 'node:child_process';

export function run(executable, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { stdio: 'inherit', windowsHide: true, ...options });

        child.once('error', reject);
        child.once('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(executable + ' exited with code ' + code))
        );
    });
}

export async function closeDesktop(child) {
    if (child.exitCode !== null || child.killed) {
        return;
    }

    const exited = new Promise((resolve) => child.once('exit', resolve));
    const timer = setTimeout(() => child.kill(), 12000);

    timer.unref();

    try {
        if (process.platform === 'win32') {
            await run(
                'powershell.exe',
                [
                    '-NoProfile',
                    '-NonInteractive',
                    '-Command',
                    '(Get-Process -Id ' +
                    child.pid +
                    ' -ErrorAction SilentlyContinue).CloseMainWindow() | Out-Null'
                ],
                { stdio: 'ignore' }
            );
        } else {
            child.kill('SIGTERM');
        }

        await exited;
    } finally {
        clearTimeout(timer);
    }
}
