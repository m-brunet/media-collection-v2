import { describe, expect, it } from 'vitest';
import type { KeptCoverArchive } from '../ports/driven/kept-cover-archive.interface.js';
import { MemoryApplicationData } from '../testing/maintenance-doubles.test-support.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { DeleteKeptCovers } from './delete-kept-covers.usecase.js';

class Deletion {
    readonly data = new MemoryApplicationData();
    readonly trail = new MemoryAuditTrail();
    kept = 3;
    readonly archive: KeptCoverArchive = {
        summary: async () => ({ count: this.kept, bytes: 0, oldestKeptAt: null }),
        deleteAll: async () => {
            const deleted = this.kept;

            this.kept = 0;

            return deleted;
        },
    };

    get subject(): DeleteKeptCovers {
        return new DeleteKeptCovers(
            this.archive,
            this.data,
            AuditDoubles.auditedOperation(this.trail),
        );
    }
}

describe('DeleteKeptCovers', () => {
    it('deletes every kept cover and tells how many', async () => {
        const deletion = new Deletion();

        const deleted = await deletion.subject.execute(TestActors.of('admin', 'admin'));

        expect(deleted).toBe(3);
        expect(deletion.kept).toBe(0);
    });

    it('removes the pictures that nothing uses any more', async () => {
        const deletion = new Deletion();

        await deletion.subject.execute(TestActors.of('admin', 'admin'));

        expect(deletion.data.covers).toEqual([]);
    });

    it('leaves the pictures still in use', async () => {
        const deletion = new Deletion();

        deletion.data.referencedCovers = ['cover.jpg'];

        await deletion.subject.execute(TestActors.of('admin', 'admin'));

        expect(deletion.data.covers).toEqual(['cover.jpg']);
    });

    it('records the deletion with the number of covers', async () => {
        const deletion = new Deletion();

        await deletion.subject.execute(TestActors.of('admin', 'admin'));

        expect(deletion.trail.entries).toEqual([
            expect.objectContaining({
                category: 'maintenance.kept-covers-deleted',
                outcome: 'successful',
                actorId: 'admin',
                before: { keptCovers: 3 },
                after: { keptCovers: 0 },
            }),
        ]);
    });

    it('refuses an Owner and deletes nothing', async () => {
        const deletion = new Deletion();

        const result = deletion.subject.execute(TestActors.of('owner', 'owner'));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
        expect(deletion.kept).toBe(3);
        expect(deletion.data.covers).toEqual(['cover.jpg']);
    });

    it('refuses a Guest', async () => {
        const deletion = new Deletion();

        const result = deletion.subject.execute(TestActors.of('guest', 'guest'));

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });
});
