import { Failure } from '../../../shared/domain/exceptions/failure.js';

export interface BackupContents {
    books: number;
    accounts: number;
}

export interface BackupManifestState {
    format: number;
    application: string;
    version: string;
    createdAt: string;
    contents: BackupContents;
    checksums: Record<string, string>;
}

export class BackupManifest {
    static readonly path = 'manifest.json';
    static readonly databasePath = 'application.sqlite';
    private static readonly format = 1;
    private static readonly application = 'Media Collection';
    private static readonly entryPaths = [
        /^application\.sqlite$/,
        /^covers\/[0-9a-f-]{36}\.(jpg|png|webp)$/,
        /^tls\/[0-9a-f-]{36}\/(chain|key)\.pem$/,
    ];

    private constructor(private readonly state: BackupManifestState) {}

    static create(
        version: string,
        createdAt: string,
        contents: BackupContents,
        checksums: Record<string, string>,
    ): BackupManifest {
        const manifest = new BackupManifest({
            format: BackupManifest.format,
            application: BackupManifest.application,
            version,
            createdAt,
            contents: { ...contents },
            checksums: { ...checksums },
        });

        manifest.ensureEntries();

        return manifest;
    }

    static parse(value: unknown): BackupManifest {
        const state = value as Partial<BackupManifestState> | null;

        BackupManifest.ensureBackup(
            typeof state === 'object' &&
                state !== null &&
                state.application === BackupManifest.application &&
                typeof state.format === 'number' &&
                typeof state.version === 'string' &&
                typeof state.createdAt === 'string' &&
                !Number.isNaN(Date.parse(state.createdAt)) &&
                BackupManifest.isCount(state.contents?.books) &&
                BackupManifest.isCount(state.contents?.accounts) &&
                typeof state.checksums === 'object' &&
                state.checksums !== null,
        );
        BackupManifest.ensureBackup(state.format === BackupManifest.format);
        const manifest = new BackupManifest(state as BackupManifestState);

        manifest.ensureEntries();

        return manifest;
    }

    static isEntryPath(path: string): boolean {
        return BackupManifest.entryPaths.some((pattern) => pattern.test(path));
    }

    get snapshot(): BackupManifestState {
        return {
            ...this.state,
            contents: { ...this.state.contents },
            checksums: { ...this.state.checksums },
        };
    }

    get version(): string {
        return this.state.version;
    }

    get createdAt(): string {
        return this.state.createdAt;
    }

    get contents(): BackupContents {
        return { ...this.state.contents };
    }

    ensureRestorableBy(version: string): void {
        if (this.state.version !== version) {
            throw new Failure(
                'invalid_input',
                'This backup was made by Media Collection ' +
                    this.state.version +
                    '; only a backup made by version ' +
                    version +
                    ' can be restored.',
                'backup-other-version',
                { backupVersion: this.state.version, currentVersion: version },
            );
        }
    }

    ensureMatches(checksums: Record<string, string>): void {
        const expected = Object.entries(this.state.checksums).sort();
        const actual = Object.entries(checksums).sort();

        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Failure('invalid_input', 'The backup file is damaged.', 'backup-damaged');
        }
    }

    private ensureEntries(): void {
        const entries = Object.entries(this.state.checksums);

        BackupManifest.ensureBackup(
            entries.some(([path]) => path === BackupManifest.databasePath) &&
                entries.every(
                    ([path, checksum]) =>
                        BackupManifest.isEntryPath(path) &&
                        typeof checksum === 'string' &&
                        /^[0-9a-f]{64}$/.test(checksum),
                ),
        );
    }

    private static isCount(value: unknown): boolean {
        return Number.isInteger(value) && (value as number) >= 0;
    }

    private static ensureBackup(condition: boolean): asserts condition {
        Failure.ensure(condition, 'This file is not a Media Collection backup.', 'backup-invalid');
    }
}
