import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class VolumeRange {
    static readonly highest = 9999;

    private constructor(
        readonly from: number,
        readonly to: number,
    ) {}

    static of(from: number, to: number): VolumeRange {
        Failure.ensure(
            Number.isInteger(from) &&
                Number.isInteger(to) &&
                from >= 0 &&
                to >= from &&
                to <= VolumeRange.highest,
            'Enter whole volume numbers from 0 to 9999, the range going upwards.',
            'volume-invalid',
        );

        return new VolumeRange(from, to);
    }

    get omnibus(): boolean {
        return this.to > this.from;
    }

    covers(volume: number): boolean {
        return volume >= this.from && volume <= this.to;
    }

    overlaps(other: VolumeRange): boolean {
        return this.from <= other.to && other.from <= this.to;
    }
}
