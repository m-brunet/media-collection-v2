import type { VolumeRange } from './volume-range.value-object.js';

export type MemberOwnership = 'owned' | 'not-owned';

// A book of the collection, as far as coverage is concerned.
export interface CoverageMember {
    bookId: string;
    ownership: MemberOwnership;
    range: VolumeRange;
}

// Owned: an Owned book covers it. Planned: only saved Not Owned books do. Inferred: no book does.
export type VolumeState = 'owned' | 'planned' | 'inferred';

export interface VolumeEntry {
    from: number;
    to: number;
    state: VolumeState;
    // Every book covering these volumes, in the order the members were given.
    bookIds: string[];
}

// What a collection's saved books cover. The expected sequence runs from 1 (or 0 when the
// collection includes volume 0) to the highest saved coverage, whatever its ownership.
// Completeness counts distinct volume numbers, never book records.
export class CollectionCoverage {
    private constructor(
        private readonly includesVolumeZero: boolean,
        private readonly members: readonly CoverageMember[],
    ) {}

    static of(includesVolumeZero: boolean, members: readonly CoverageMember[]): CollectionCoverage {
        return new CollectionCoverage(includesVolumeZero, [...members]);
    }

    get start(): number {
        return this.includesVolumeZero ? 0 : 1;
    }

    // Null without any member.
    get highest(): number | null {
        return this.members.length === 0
            ? null
            : Math.max(...this.members.map((member) => member.range.to));
    }

    get expected(): number {
        const highest = this.highest;

        return highest === null || highest < this.start ? 0 : highest - this.start + 1;
    }

    get ownedVolumes(): number {
        return this.expected - this.missing.length;
    }

    // Expected volumes no Owned book covers, saved Not Owned or inferred alike.
    get missing(): number[] {
        return this.expectedVolumes().filter((volume) => this.state(volume) !== 'owned');
    }

    // The highest number an Owned book covers, an omnibus range end included.
    get lastOwned(): number | null {
        const owned = this.members.filter((member) => member.ownership === 'owned');

        return owned.length === 0 ? null : Math.max(...owned.map((member) => member.range.to));
    }

    get coversVolumeZero(): boolean {
        return this.members.some((member) => member.range.covers(0));
    }

    // Each expected volume in order, consecutive inferred volumes grouped into one entry.
    volumes(): VolumeEntry[] {
        const entries: VolumeEntry[] = [];

        for (const volume of this.expectedVolumes()) {
            const state = this.state(volume);
            const previous = entries.at(-1);

            if (state === 'inferred' && previous?.state === 'inferred') {
                previous.to = volume;
            } else {
                entries.push({
                    from: volume,
                    to: volume,
                    state,
                    bookIds: this.coveringIds(volume),
                });
            }
        }

        return entries;
    }

    // Overlap is allowed only between Owned books: any overlap involving a Not Owned book,
    // on either side, conflicts. The candidate's own saved coverage is ignored.
    conflictsWith(candidate: CoverageMember): CoverageMember[] {
        return this.members.filter(
            (member) =>
                member.bookId !== candidate.bookId &&
                member.range.overlaps(candidate.range) &&
                (member.ownership === 'not-owned' || candidate.ownership === 'not-owned'),
        );
    }

    private expectedVolumes(): number[] {
        const volumes: number[] = [];
        const highest = this.highest ?? this.start - 1;

        for (let volume = this.start; volume <= highest; volume++) {
            volumes.push(volume);
        }

        return volumes;
    }

    private state(volume: number): VolumeState {
        const covering = this.members.filter((member) => member.range.covers(volume));

        if (covering.some((member) => member.ownership === 'owned')) {
            return 'owned';
        }

        return covering.length > 0 ? 'planned' : 'inferred';
    }

    private coveringIds(volume: number): string[] {
        return this.members
            .filter((member) => member.range.covers(volume))
            .map((member) => member.bookId);
    }
}
