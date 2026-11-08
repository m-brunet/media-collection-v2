import { describe, expect, it } from 'vitest';
import { BackupManifest } from './backup-manifest.value-object.js';

const digest = 'a'.repeat(64);
const cover = 'covers/0b6f3c3e-8a51-4c8e-9a43-7f1a3f0e5b11.jpg';

function saved(changes: Record<string, unknown> = {}) {
    return {
        format: 1,
        application: 'Media Collection',
        version: '0.1.0',
        createdAt: '2026-11-08T13:30:05.000Z',
        contents: { books: 3, accounts: 2 },
        checksums: { 'application.sqlite': digest, [cover]: digest },
        ...changes,
    };
}

describe('BackupManifest.create', () => {
    it('describes the backup of the current version', () => {
        const manifest = BackupManifest.create(
            '0.1.0',
            '2026-11-08T13:30:05.000Z',
            { books: 3, accounts: 2 },
            { 'application.sqlite': digest },
        );

        const result = manifest.snapshot;

        expect(result).toEqual({
            format: 1,
            application: 'Media Collection',
            version: '0.1.0',
            createdAt: '2026-11-08T13:30:05.000Z',
            contents: { books: 3, accounts: 2 },
            checksums: { 'application.sqlite': digest },
        });
    });
    it('requires the database', () => {
        const create = () =>
            BackupManifest.create(
                '0.1.0',
                '2026-11-08T13:30:05.000Z',
                { books: 0, accounts: 1 },
                {},
            );

        expect(create).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
});

describe('BackupManifest.parse', () => {
    it('reads a saved manifest', () => {
        const manifest = BackupManifest.parse(saved());

        const result = manifest.snapshot;

        expect(result).toEqual(saved());
    });
    it('rejects something that is not a manifest', () => {
        const parse = () => BackupManifest.parse('backup');

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('rejects another application', () => {
        const parse = () => BackupManifest.parse(saved({ application: 'Other' }));

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('rejects an unknown format', () => {
        const parse = () => BackupManifest.parse(saved({ format: 2 }));

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('rejects an invalid creation date', () => {
        const parse = () => BackupManifest.parse(saved({ createdAt: 'yesterday' }));

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('rejects negative counts', () => {
        const parse = () => BackupManifest.parse(saved({ contents: { books: -1, accounts: 1 } }));

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('rejects an entry outside the application data', () => {
        const checksums = { 'application.sqlite': digest, '../session.key': digest };

        const parse = () => BackupManifest.parse(saved({ checksums }));

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('rejects a malformed checksum', () => {
        const parse = () =>
            BackupManifest.parse(saved({ checksums: { 'application.sqlite': 'x' } }));

        expect(parse).toThrow(expect.objectContaining({ reason: 'backup-invalid' }));
    });
    it('accepts the HTTPS certificate files', () => {
        const checksums = {
            'application.sqlite': digest,
            'tls/0b6f3c3e-8a51-4c8e-9a43-7f1a3f0e5b11/key.pem': digest,
        };

        const manifest = BackupManifest.parse(saved({ checksums }));

        expect(manifest.snapshot.checksums).toEqual(checksums);
    });
});

describe('BackupManifest.ensureRestorableBy', () => {
    it('accepts the same version', () => {
        const manifest = BackupManifest.parse(saved());

        const check = () => manifest.ensureRestorableBy('0.1.0');

        expect(check).not.toThrow();
    });
    it('rejects another version, naming both', () => {
        const manifest = BackupManifest.parse(saved());

        const check = () => manifest.ensureRestorableBy('0.2.0');

        expect(check).toThrow(
            expect.objectContaining({
                reason: 'backup-other-version',
                details: { backupVersion: '0.1.0', currentVersion: '0.2.0' },
            }),
        );
    });
});

describe('BackupManifest.ensureMatches', () => {
    it('accepts the listed entries', () => {
        const manifest = BackupManifest.parse(saved());

        const check = () =>
            manifest.ensureMatches({ [cover]: digest, 'application.sqlite': digest });

        expect(check).not.toThrow();
    });
    it('rejects a changed entry', () => {
        const manifest = BackupManifest.parse(saved());

        const check = () =>
            manifest.ensureMatches({ 'application.sqlite': 'b'.repeat(64), [cover]: digest });

        expect(check).toThrow(expect.objectContaining({ reason: 'backup-damaged' }));
    });
    it('rejects a missing entry', () => {
        const manifest = BackupManifest.parse(saved());

        const check = () => manifest.ensureMatches({ 'application.sqlite': digest });

        expect(check).toThrow(expect.objectContaining({ reason: 'backup-damaged' }));
    });
    it('rejects an unlisted entry', () => {
        const manifest = BackupManifest.parse(saved());
        const extra = 'covers/1b6f3c3e-8a51-4c8e-9a43-7f1a3f0e5b11.png';

        const check = () =>
            manifest.ensureMatches({
                'application.sqlite': digest,
                [cover]: digest,
                [extra]: digest,
            });

        expect(check).toThrow(expect.objectContaining({ reason: 'backup-damaged' }));
    });
});
