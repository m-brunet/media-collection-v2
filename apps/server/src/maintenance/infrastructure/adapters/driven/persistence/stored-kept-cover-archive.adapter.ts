import type {
    KeptCoverArchive,
    KeptCoverSummary,
} from '../../../../application/ports/driven/kept-cover-archive.interface.js';
import type { CoverStorage } from '../../../../../books/application/ports/driven/cover-storage.interface.js';
import type { KeptCoverStore } from '../../../../../books/application/ports/driven/kept-cover-store.interface.js';

export class StoredKeptCoverArchive implements KeptCoverArchive {
    constructor(
        private readonly store: KeptCoverStore,
        private readonly covers: CoverStorage,
    ) {}

    async summary(): Promise<KeptCoverSummary> {
        const kept = await this.store.all();
        const dates = kept.map((cover) => cover.keptAt).sort();
        let bytes = 0;

        for (const { file } of kept) {
            bytes += (await this.covers.size(file)) ?? 0;
        }

        return { count: kept.length, bytes, oldestKeptAt: dates[0] ?? null };
    }

    deleteAll(): Promise<number> {
        return this.store.clear();
    }
}
