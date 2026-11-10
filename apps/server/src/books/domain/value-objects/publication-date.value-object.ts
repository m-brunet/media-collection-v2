import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class PublicationDate {
    private constructor(
        readonly year: number,
        readonly month: number | null,
    ) {
        Object.freeze(this);
    }

    static from(year: number | null, month: number | null): PublicationDate | null {
        if (year === null) {
            Failure.ensure(
                month === null,
                'A publication month needs a year.',
                'publication-month-without-year',
            );

            return null;
        }

        Failure.ensure(
            Number.isInteger(year) && year >= 1 && year <= 9999,
            'Enter a publication year between 1 and 9999.',
            'publication-year-invalid',
        );
        Failure.ensure(
            month === null || (Number.isInteger(month) && month >= 1 && month <= 12),
            'Choose a publication month from January to December.',
            'publication-month-invalid',
        );

        return new PublicationDate(year, month);
    }
}
