import { expect, it } from 'vitest';
import { Collection } from './collection.entity.js';
import type { CollectionStatus } from './collection.entity.js';
import type {
    CoverageMember,
    MemberOwnership,
} from '../value-objects/collection-coverage.value-object.js';
import { VolumeRange } from '../value-objects/volume-range.value-object.js';

const now = '2026-02-01T00:00:00.000Z';

function collection(changes: { status?: CollectionStatus; includesVolumeZero?: boolean } = {}) {
    return new Collection({
        id: 'collection',
        name: ' Batman ',
        category: 'comics',
        includesVolumeZero: changes.includesVolumeZero ?? false,
        status: changes.status ?? 'unfinished',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
    });
}

function member(
    bookId: string,
    ownership: MemberOwnership,
    from: number,
    to = from,
): CoverageMember {
    return { bookId, ownership, range: VolumeRange.of(from, to) };
}

it('keeps the trimmed displayed name', () => {
    const name = ' Batman ';

    const created = new Collection({ ...collection().snapshot, name });

    expect(created.snapshot.name).toBe('Batman');
});

it('compares names without case or accents', () => {
    const created = new Collection({ ...collection().snapshot, name: 'Astérix' });

    const key = created.key;

    expect(key).toBe('asterix');
});

it('rejects an empty name', () => {
    const name = '   ';

    const operation = () => new Collection({ ...collection().snapshot, name });

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-name-invalid' }));
});

it('renames the collection', () => {
    const subject = collection();

    subject.rename('The Batman', now);

    expect(subject.snapshot).toMatchObject({ name: 'The Batman', updatedAt: now });
});

it('marks a collection Finished when every expected volume is Owned', () => {
    const subject = collection();

    subject.finish([member('a', 'owned', 1, 3)], now);

    expect(subject.snapshot.status).toBe('finished');
});

it('refuses Finished while a volume is missing', () => {
    const subject = collection();

    const operation = () => subject.finish([member('a', 'owned', 1), member('c', 'owned', 3)], now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-incomplete' }));
    expect(subject.snapshot.status).toBe('unfinished');
});

it('refuses Finished while the highest volume is only planned', () => {
    const subject = collection();

    const operation = () =>
        subject.finish([member('a', 'owned', 1), member('b', 'not-owned', 2)], now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-incomplete' }));
});

it('reopens a Finished collection a new missing volume leaves incomplete', () => {
    const subject = collection({ status: 'finished' });

    const reopened = subject.reconcile([member('a', 'owned', 1), member('b', 'not-owned', 2)], now);

    expect(reopened).toBe(true);
    expect(subject.snapshot.status).toBe('unfinished');
});

it('does not mark a collection Finished when its gap is filled', () => {
    const subject = collection();

    const reopened = subject.reconcile([member('a', 'owned', 1, 2)], now);

    expect(reopened).toBe(false);
    expect(subject.snapshot.status).toBe('unfinished');
});

it('keeps a Finished collection Finished when its highest volume is removed', () => {
    const subject = collection({ status: 'finished' });

    const reopened = subject.reconcile([member('a', 'owned', 1, 19)], now);

    expect(reopened).toBe(false);
    expect(subject.snapshot.status).toBe('finished');
});

it('reopens manually without any gap', () => {
    const subject = collection({ status: 'finished' });

    subject.reopen(now);

    expect(subject.snapshot.status).toBe('unfinished');
});

it('enables volume 0', () => {
    const subject = collection();

    subject.changeVolumeZero(true, [member('a', 'owned', 1)], now);

    expect(subject.snapshot.includesVolumeZero).toBe(true);
});

it('refuses to disable volume 0 while a book covers it', () => {
    const subject = collection({ includesVolumeZero: true });

    const operation = () => subject.changeVolumeZero(false, [member('a', 'owned', 0, 2)], now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'volume-zero-in-use' }));
    expect(subject.snapshot.includesVolumeZero).toBe(true);
});

it('disables volume 0 when no book covers it', () => {
    const subject = collection({ includesVolumeZero: true });

    subject.changeVolumeZero(false, [member('a', 'owned', 1)], now);

    expect(subject.snapshot.includesVolumeZero).toBe(false);
});

it('admits a book of its category', () => {
    const subject = collection();

    const operation = () => subject.admit('comics', 4);

    expect(operation).not.toThrow();
});

it('refuses a book of another category with the collection details', () => {
    const subject = collection();

    const operation = () => subject.admit('manga', 4);

    expect(operation).toThrow(
        expect.objectContaining({
            code: 'conflict',
            reason: 'collection-category-mismatch',
            details: {
                collectionId: 'collection',
                name: 'Batman',
                category: 'comics',
                bookCategory: 'manga',
                bookCount: 4,
            },
        }),
    );
});

it('changes the category of the collection', () => {
    const subject = collection();

    subject.changeCategory('manga', now);

    expect(subject.snapshot).toMatchObject({ category: 'manga', updatedAt: now });
});

it('drops an unfinished collection', () => {
    const subject = collection();

    subject.drop(now);

    expect(subject.snapshot.status).toBe('dropped');
    expect(subject.snapshot.updatedAt).toBe(now);
});

it('refuses to drop a finished collection', () => {
    const subject = collection({ status: 'finished' });

    const operation = () => subject.drop(now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-finished' }));
});

it('refuses to drop a collection already dropped', () => {
    const subject = collection({ status: 'dropped' });

    const operation = () => subject.drop(now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-dropped' }));
});

it('resumes a dropped collection as unfinished', () => {
    const subject = collection({ status: 'dropped' });

    subject.resume(now);

    expect(subject.snapshot.status).toBe('unfinished');
});

it('refuses to resume a collection that is not dropped', () => {
    const subject = collection();

    const operation = () => subject.resume(now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-not-dropped' }));
});

it('refuses to reopen a dropped collection', () => {
    const subject = collection({ status: 'dropped' });

    const operation = () => subject.reopen(now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-dropped' }));
});

it('marks a dropped collection Finished when every expected volume is Owned', () => {
    const subject = collection({ status: 'dropped' });

    subject.finish([member('a', 'owned', 1, 3)], now);

    expect(subject.snapshot.status).toBe('finished');
});

it('refuses Finished on a dropped collection while a volume is missing', () => {
    const subject = collection({ status: 'dropped' });

    const operation = () => subject.finish([member('a', 'owned', 1), member('b', 'owned', 3)], now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-incomplete' }));
});

it('keeps a dropped collection dropped when a gap appears', () => {
    const subject = collection({ status: 'dropped' });

    const reopened = subject.reconcile([member('a', 'owned', 1), member('b', 'not-owned', 2)], now);

    expect(reopened).toBe(false);
    expect(subject.snapshot.status).toBe('dropped');
});
