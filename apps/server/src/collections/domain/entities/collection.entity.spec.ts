import { expect, it } from 'vitest';
import { Collection } from './collection.entity.js';
import type {
    CoverageMember,
    MemberOwnership,
} from '../value-objects/collection-coverage.value-object.js';
import { VolumeRange } from '../value-objects/volume-range.value-object.js';

const now = '2026-02-01T00:00:00.000Z';

function collection(changes: { finished?: boolean; includesVolumeZero?: boolean } = {}) {
    return new Collection({
        id: 'collection',
        name: ' Batman ',
        includesVolumeZero: changes.includesVolumeZero ?? false,
        finished: changes.finished ?? false,
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

    expect(subject.snapshot.finished).toBe(true);
});

it('refuses Finished while a volume is missing', () => {
    const subject = collection();

    const operation = () => subject.finish([member('a', 'owned', 1), member('c', 'owned', 3)], now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-incomplete' }));
    expect(subject.snapshot.finished).toBe(false);
});

it('refuses Finished while the highest volume is only planned', () => {
    const subject = collection();

    const operation = () =>
        subject.finish([member('a', 'owned', 1), member('b', 'not-owned', 2)], now);

    expect(operation).toThrow(expect.objectContaining({ reason: 'collection-incomplete' }));
});

it('reopens a Finished collection a new missing volume leaves incomplete', () => {
    const subject = collection({ finished: true });

    const reopened = subject.reconcile([member('a', 'owned', 1), member('b', 'not-owned', 2)], now);

    expect(reopened).toBe(true);
    expect(subject.snapshot.finished).toBe(false);
});

it('does not mark a collection Finished when its gap is filled', () => {
    const subject = collection();

    const reopened = subject.reconcile([member('a', 'owned', 1, 2)], now);

    expect(reopened).toBe(false);
    expect(subject.snapshot.finished).toBe(false);
});

it('keeps a Finished collection Finished when its highest volume is removed', () => {
    const subject = collection({ finished: true });

    const reopened = subject.reconcile([member('a', 'owned', 1, 19)], now);

    expect(reopened).toBe(false);
    expect(subject.snapshot.finished).toBe(true);
});

it('reopens manually without any gap', () => {
    const subject = collection({ finished: true });

    subject.reopen(now);

    expect(subject.snapshot.finished).toBe(false);
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
