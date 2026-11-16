import type {
    KeptCoverArchive,
    KeptCoverSummary,
} from '../../../../application/ports/driven/kept-cover-archive.interface.js';
import type { CoverStorage } from '../../../../../books/application/ports/driven/cover-storage.interface.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyKeptCoverArchive implements KeptCoverArchive {
    constructor(
        private readonly connections: DatabaseConnections,
        private readonly covers: CoverStorage,
    ) {}

    async summary(): Promise<KeptCoverSummary> {
        const kept = await this.connections.current
            .selectFrom('kept_covers')
            .select(['file', 'kept_at'])
            .orderBy('kept_at')
            .execute();
        let bytes = 0;

        for (const { file } of kept) {
            bytes += (await this.covers.size(file)) ?? 0;
        }

        return { count: kept.length, bytes, oldestKeptAt: kept[0]?.kept_at ?? null };
    }

    async deleteAll(): Promise<number> {
        const deleted = await this.connections.current.deleteFrom('kept_covers').executeTakeFirst();

        return Number(deleted.numDeletedRows);
    }
}
