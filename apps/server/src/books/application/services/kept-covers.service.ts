import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import type { KeptCoverStore } from '../ports/driven/kept-cover-store.interface.js';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import type { Clock } from '../../../shared/application/ports/driven/clock.interface.js';
import type { IdGenerator } from '../../../shared/application/ports/driven/id-generator.interface.js';

export class KeptCovers {
    static readonly source = 'libris';
    private static readonly scheme = 'kept:';

    constructor(
        private readonly store: KeptCoverStore,
        private readonly covers: CoverStorage,
        private readonly ids: IdGenerator,
        private readonly clock: Clock,
    ) {}

    static isKept(address: string): boolean {
        return address.startsWith(KeptCovers.scheme);
    }

    async keep(isbn13: string | null, file: string | null): Promise<void> {
        if (!file) {
            return;
        }

        if (!isbn13) {
            await this.covers.remove(file);

            return;
        }

        const earlier = await this.store.find(isbn13);

        await this.store.put({
            id: this.ids.next(),
            isbn13,
            file,
            keptAt: this.clock.now().toISOString(),
        });

        if (earlier && earlier.file !== file) {
            await this.covers.remove(earlier.file);
        }
    }

    async release(isbn13: string | null): Promise<void> {
        const kept = isbn13 ? await this.store.find(isbn13) : null;

        if (kept) {
            await this.store.remove(kept.isbn13);
            await this.covers.remove(kept.file);
        }
    }

    async forget(isbn13: string | null): Promise<void> {
        if (isbn13) {
            await this.store.remove(isbn13);
        }
    }

    async offer(isbn13: string): Promise<CoverOffer | null> {
        const kept = await this.store.find(isbn13);

        return kept
            ? {
                  address: KeptCovers.scheme + kept.file,
                  width: null,
                  height: null,
                  fingerprint: null,
              }
            : null;
    }

    async read(address: string): Promise<Uint8Array | null> {
        const stored = await this.covers.read(address.slice(KeptCovers.scheme.length));

        return stored?.bytes ?? null;
    }
}
