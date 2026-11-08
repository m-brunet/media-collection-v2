import type { ApplicationDataFiles } from '../ports/driven/application-data-files.interface.js';
import type { BackupArchive } from '../ports/driven/backup-archive.interface.js';
import type { Checksums } from '../ports/driven/checksums.interface.js';
import type { LibraryContentsReader } from '../ports/driven/library-contents-reader.interface.js';
import type { MaintenanceJournal } from '../ports/driven/maintenance-journal.interface.js';
import type { SessionKeyRotation } from '../ports/driven/session-key-rotation.interface.js';
import type {
    BackupContents,
    BackupManifestState,
} from '../../domain/value-objects/backup-manifest.value-object.js';
import type { DataFile } from '../data-file.js';
import type { MaintenanceRecord } from '../maintenance-audit.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class MemoryDataFiles implements ApplicationDataFiles {
    replaced = 0;
    failReplace = false;

    constructor(public files: DataFile[] | null) {}

    async exists(): Promise<boolean> {
        return this.files !== null;
    }

    async read(): Promise<DataFile[]> {
        return (this.files ?? []).map((file) => ({ ...file }));
    }

    async replace(files: readonly DataFile[]): Promise<void> {
        if (this.failReplace) {
            throw new Failure('invalid_input', 'The backup file is damaged.', 'backup-damaged');
        }

        this.files = files.map((file) => ({ ...file }));
        this.replaced++;
    }
}

export class MemoryArchive implements BackupArchive {
    readonly saved = new Map<string, { manifest: unknown; files: DataFile[] }>();
    failWrite = false;

    async write(
        destination: string,
        manifest: BackupManifestState,
        files: readonly DataFile[],
    ): Promise<void> {
        if (this.failWrite) {
            throw new Error('The disk is full.');
        }

        this.saved.set(destination, { manifest: structuredClone(manifest), files: [...files] });
    }

    async read(source: string): Promise<{ manifest: unknown; files: DataFile[] }> {
        const saved = this.saved.get(source);

        if (!saved) {
            throw new Failure(
                'invalid_input',
                'This file is not a Media Collection backup.',
                'backup-invalid',
            );
        }

        return { manifest: structuredClone(saved.manifest), files: [...saved.files] };
    }
}

// Hexadecimal of the first 32 bytes: readable in tests and shaped like a SHA-256.
export class HexChecksums implements Checksums {
    of(bytes: Uint8Array): string {
        return [...bytes.slice(0, 32)]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('')
            .padEnd(64, '0');
    }
}

export class FixedLibraryContents implements LibraryContentsReader {
    constructor(private readonly contents: BackupContents) {}

    async read(): Promise<BackupContents> {
        return { ...this.contents };
    }
}

export class MemoryJournal implements MaintenanceJournal {
    readonly records: MaintenanceRecord[] = [];

    async record(record: MaintenanceRecord): Promise<void> {
        this.records.push(record);
    }
}

export class CountingSessionKeyRotation implements SessionKeyRotation {
    rotations = 0;

    async rotate(): Promise<void> {
        this.rotations++;
    }
}

export class MaintenanceDoubles {
    static readonly clock = { now: () => new Date('2026-11-08T13:30:05.000Z') };

    static file(path: string, text: string): DataFile {
        return { path, bytes: new TextEncoder().encode(text) };
    }

    static library(): DataFile[] {
        return [
            MaintenanceDoubles.file('application.sqlite', 'database'),
            MaintenanceDoubles.file('covers/0b6f3c3e-8a51-4c8e-9a43-7f1a3f0e5b11.jpg', 'cover'),
        ];
    }
}
