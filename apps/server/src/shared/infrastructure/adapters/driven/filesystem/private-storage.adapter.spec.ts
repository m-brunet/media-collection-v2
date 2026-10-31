import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { PrivateStorage } from './private-storage.adapter.js';

const directories: string[] = [];

afterEach(() => {
    for (const directory of directories.splice(0)) {
        rmSync(directory, { recursive: true, force: true });
    }
});

function directory() {
    const value = mkdtempSync(join(tmpdir(), 'electron-private-storage-'));

    directories.push(value);

    return value;
}

function permissions(path: string) {
    if (process.platform !== 'win32') {
        return { mode: statSync(path).mode & 0o777 };
    }

    const script =
        "$acl = Get-Acl -LiteralPath '" +
        path.replaceAll("'", "''") +
        "'\n[pscustomobject]@{Protected=$acl.AreAccessRulesProtected; Accounts=@($acl.Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value })} | ConvertTo-Json -Compress";

    return JSON.parse(
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
            encoding: 'utf8',
            windowsHide: true,
        }),
    ) as { Protected: boolean; Accounts: string[] };
}

it('restricts a private directory', () => {
    const isDirectory = true;
    const parent = directory();
    const path = isDirectory ? parent : join(parent, 'secret');

    if (!isDirectory) {
        writeFileSync(path, 'test-secret');
    }

    const subject = new PrivateStorage();

    subject.restrict(path, isDirectory);

    if (!isDirectory) {
        expect(readFileSync(path, 'utf8')).toBe('test-secret');
    }

    const result = permissions(path);

    if ('mode' in result) {
        expect(result.mode).toBe(isDirectory ? 0o700 : 0o600);
    } else {
        expect(result.Protected).toBe(true);
        expect(result.Accounts).toHaveLength(3);
        expect(result.Accounts).toContain('S-1-5-18');
        expect(result.Accounts).toContain('S-1-5-32-544');
        expect(result.Accounts).not.toContain('S-1-1-0');
    }
});
it('restricts a private file', () => {
    const isDirectory = false;
    const parent = directory();
    const path = isDirectory ? parent : join(parent, 'secret');

    if (!isDirectory) {
        writeFileSync(path, 'test-secret');
    }

    const subject = new PrivateStorage();

    subject.restrict(path, isDirectory);

    if (!isDirectory) {
        expect(readFileSync(path, 'utf8')).toBe('test-secret');
    }

    const result = permissions(path);

    if ('mode' in result) {
        expect(result.mode).toBe(isDirectory ? 0o700 : 0o600);
    } else {
        expect(result.Protected).toBe(true);
        expect(result.Accounts).toHaveLength(3);
        expect(result.Accounts).toContain('S-1-5-18');
        expect(result.Accounts).toContain('S-1-5-32-544');
        expect(result.Accounts).not.toContain('S-1-1-0');
    }
});
