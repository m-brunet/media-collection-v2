import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { NameKey } from '../../../shared/domain/name-key.helper.js';
import { CollectionCoverage } from '../value-objects/collection-coverage.value-object.js';
import type { CoverageMember } from '../value-objects/collection-coverage.value-object.js';
import { VolumeRange } from '../value-objects/volume-range.value-object.js';

export type CollectionCategory = 'books' | 'manga' | 'comics';

export type CollectionStatus = 'unfinished' | 'finished' | 'dropped';

export interface CollectionState {
    id: string;
    name: string;
    category: CollectionCategory;
    includesVolumeZero: boolean;
    status: CollectionStatus;
    lastVolume: number | null;
    createdAt: string;
    updatedAt: string;
}

export class Collection {
    private state: CollectionState;

    constructor(state: CollectionState) {
        this.state = { ...state, name: Collection.validName(state.name) };
    }

    get id(): string {
        return this.state.id;
    }

    get snapshot(): CollectionState {
        return { ...this.state };
    }

    get key(): string {
        return NameKey.of(this.state.name);
    }

    static validName(value: string): string {
        const name = value.trim();

        Failure.ensure(
            name.length >= 1 && name.length <= 200,
            'Enter a collection name of up to 200 characters.',
            'collection-name-invalid',
        );

        return name;
    }

    coverage(members: readonly CoverageMember[]): CollectionCoverage {
        return CollectionCoverage.of(this.state.includesVolumeZero, members, this.state.lastVolume);
    }

    rename(name: string, now: string): void {
        this.state.name = Collection.validName(name);
        this.state.updatedAt = now;
    }

    admit(bookCategory: CollectionCategory, bookCount: number): void {
        if (bookCategory === this.state.category) {
            return;
        }

        throw new Failure(
            'conflict',
            'This book does not have the category of its collection.',
            'collection-category-mismatch',
            {
                collectionId: this.state.id,
                name: this.state.name,
                category: this.state.category,
                bookCategory,
                bookCount,
            },
        );
    }

    changeCategory(category: CollectionCategory, now: string): void {
        this.state.category = category;
        this.state.updatedAt = now;
    }

    changeVolumeZero(enabled: boolean, members: readonly CoverageMember[], now: string): void {
        if (!enabled && this.coverage(members).coversVolumeZero) {
            throw new Failure(
                'conflict',
                'A saved book covers volume 0, so the collection must keep including it.',
                'volume-zero-in-use',
            );
        }

        this.state.includesVolumeZero = enabled;
        this.state.updatedAt = now;
    }

    changeLastVolume(
        lastVolume: number | null,
        members: readonly CoverageMember[],
        now: string,
    ): void {
        if (lastVolume !== null) {
            const start = this.coverage(members).start;

            Failure.ensure(
                Number.isInteger(lastVolume) &&
                    lastVolume >= start &&
                    lastVolume <= VolumeRange.highest,
                'Enter a last volume from ' + start + ' to ' + VolumeRange.highest + '.',
                'last-volume-invalid',
            );

            const highest = CollectionCoverage.of(this.state.includesVolumeZero, members).highest;

            if (highest !== null && lastVolume < highest) {
                throw new Failure(
                    'conflict',
                    'Volume ' + highest + ' is saved in this collection.',
                    'last-volume-below-saved',
                    { volume: highest },
                );
            }
        }

        this.state.lastVolume = lastVolume;
        this.state.updatedAt = now;
    }

    extend(members: readonly CoverageMember[], now: string): boolean {
        const highest = CollectionCoverage.of(this.state.includesVolumeZero, members).highest;

        if (
            this.state.lastVolume === null ||
            highest === null ||
            highest <= this.state.lastVolume
        ) {
            return false;
        }

        this.state.lastVolume = highest;
        this.state.updatedAt = now;

        return true;
    }

    finish(members: readonly CoverageMember[], now: string): void {
        if (members.length === 0 || this.coverage(members).missing.length > 0) {
            throw new Failure(
                'conflict',
                'Own every expected volume before marking this collection Finished.',
                'collection-incomplete',
            );
        }

        this.change('finished', now);
    }

    reopen(now: string): void {
        if (this.state.status === 'dropped') {
            throw new Failure(
                'conflict',
                'Resume this collection instead of reopening it.',
                'collection-dropped',
            );
        }

        this.change('unfinished', now);
    }

    drop(now: string): void {
        if (this.state.status === 'finished') {
            throw new Failure(
                'conflict',
                'Reopen this collection before dropping it.',
                'collection-finished',
            );
        }

        if (this.state.status === 'dropped') {
            throw new Failure(
                'conflict',
                'This collection is already dropped.',
                'collection-dropped',
            );
        }

        this.change('dropped', now);
    }

    resume(now: string): void {
        if (this.state.status !== 'dropped') {
            throw new Failure(
                'conflict',
                'Only a dropped collection can be resumed.',
                'collection-not-dropped',
            );
        }

        this.change('unfinished', now);
    }

    reconcile(members: readonly CoverageMember[], now: string): boolean {
        if (this.state.status !== 'finished' || this.coverage(members).missing.length === 0) {
            return false;
        }

        this.reopen(now);

        return true;
    }

    private change(status: CollectionStatus, now: string): void {
        this.state.status = status;
        this.state.updatedAt = now;
    }
}
