import { expect, it } from 'vitest';
import { VolumeRange } from './volume-range.value-object.js';

it('accepts a single volume', () => {
    const volume = 3;

    const range = VolumeRange.of(volume, volume);

    expect(range).toMatchObject({ from: 3, to: 3, omnibus: false });
});

it('accepts a consecutive omnibus range', () => {
    const from = 1;

    const range = VolumeRange.of(from, 3);

    expect(range).toMatchObject({ from: 1, to: 3, omnibus: true });
});

it('accepts volume 0', () => {
    const volume = 0;

    const range = VolumeRange.of(volume, volume);

    expect(range.covers(0)).toBe(true);
});

it('rejects a fractional volume', () => {
    const volume = 2.5;

    const operation = () => VolumeRange.of(volume, volume);

    expect(operation).toThrow(expect.objectContaining({ reason: 'volume-invalid' }));
});

it('rejects a negative volume', () => {
    const volume = -1;

    const operation = () => VolumeRange.of(volume, volume);

    expect(operation).toThrow(expect.objectContaining({ reason: 'volume-invalid' }));
});

it('rejects a range going downwards', () => {
    const from = 5;

    const operation = () => VolumeRange.of(from, 3);

    expect(operation).toThrow(expect.objectContaining({ reason: 'volume-invalid' }));
});

it('rejects a volume above 9999', () => {
    const volume = 10000;

    const operation = () => VolumeRange.of(volume, volume);

    expect(operation).toThrow(expect.objectContaining({ reason: 'volume-invalid' }));
});

it('detects a partial overlap between ranges', () => {
    const omnibus = VolumeRange.of(1, 5);

    const overlaps = omnibus.overlaps(VolumeRange.of(5, 7));

    expect(overlaps).toBe(true);
});

it('does not see adjacent ranges as overlapping', () => {
    const omnibus = VolumeRange.of(1, 3);

    const overlaps = omnibus.overlaps(VolumeRange.of(4, 6));

    expect(overlaps).toBe(false);
});
