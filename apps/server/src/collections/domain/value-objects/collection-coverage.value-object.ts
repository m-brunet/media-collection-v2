import type { VolumeRange } from './volume-range.value-object.js';

export type MemberOwnership = 'owned' | 'not-owned';

export interface CoverageMember {
    bookId: string;
    ownership: MemberOwnership;
    range: VolumeRange;
}

export type VolumeState = 'owned' | 'planned' | 'inferred';

export interface VolumeEntry {
    from: number;
    to: number;
    state: VolumeState;
    bookIds: string[];
}

export class CollectionCoverage {
    private constructor(
        private readonly includesVolumeZero: boolean,
        private readonly members: readonly CoverageMember[],
        private readonly lastVolume: number | null,
    ) {}

    static of(
        includesVolumeZero: boolean,
        members: readonly CoverageMember[],
        lastVolume: number | null = null,
    ): CollectionCoverage {
        return new CollectionCoverage(includesVolumeZero, [...members], lastVolume);
    }

    get start(): number {
        return this.includesVolumeZero ? 0 : 1;
    }

    get highest(): number | null {
        return this.members.length === 0
            ? null
            : Math.max(...this.members.map((member) => member.range.to));
    }

    get end(): number | null {
        const highest = this.highest;

        if (this.lastVolume === null) {
            return highest;
        }

        return highest === null ? this.lastVolume : Math.max(highest, this.lastVolume);
    }

    get expected(): number {
        const end = this.end;

        return end === null || end < this.start ? 0 : end - this.start + 1;
    }

    get ownedVolumes(): number {
        return this.expected - this.missing.length;
    }

    get missing(): number[] {
        return this.expectedVolumes().filter((volume) => this.state(volume) !== 'owned');
    }

    get lastOwned(): number | null {
        const owned = this.members.filter((member) => member.ownership === 'owned');

        return owned.length === 0 ? null : Math.max(...owned.map((member) => member.range.to));
    }

    get coversVolumeZero(): boolean {
        return this.members.some((member) => member.range.covers(0));
    }

    uncovered(upTo: number): number[] {
        const volumes: number[] = [];

        for (let volume = this.start; volume <= upTo; volume++) {
            if (!this.members.some((member) => member.range.covers(volume))) {
                volumes.push(volume);
            }
        }

        return volumes;
    }

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
        const end = this.end ?? this.start - 1;

        for (let volume = this.start; volume <= end; volume++) {
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
