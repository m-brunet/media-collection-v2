import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type LocationKind = 'bookcase' | 'shelf';

// A free label for a bookcase or shelf, kept as typed apart from outer spaces.
export class LocationName {
    static of(value: string, kind: LocationKind): string {
        const name = value.trim();

        Failure.ensure(
            name.length >= 1 && name.length <= 100,
            'Enter a ' + kind + ' name of up to 100 characters.',
            kind + '-name-invalid',
        );

        return name;
    }
}
