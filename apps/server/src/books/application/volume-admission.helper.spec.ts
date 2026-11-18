import { describe, expect, it } from 'vitest';
import { VolumeAdmission } from './volume-admission.helper.js';

describe('VolumeAdmission', () => {
    it('admits volumes in an unfinished collection', () => {
        const collection = { status: 'unfinished' as const };

        const operation = () => VolumeAdmission.ensureOpen(collection);

        expect(operation).not.toThrow();
    });

    it('refuses volumes in a finished collection', () => {
        const collection = { status: 'finished' as const };

        const operation = () => VolumeAdmission.ensureOpen(collection);

        expect(operation).toThrow(
            expect.objectContaining({ code: 'conflict', reason: 'collection-finished' }),
        );
    });

    it('refuses volumes in a dropped collection', () => {
        const collection = { status: 'dropped' as const };

        const operation = () => VolumeAdmission.ensureOpen(collection);

        expect(operation).toThrow(
            expect.objectContaining({ code: 'conflict', reason: 'collection-dropped' }),
        );
    });
});
