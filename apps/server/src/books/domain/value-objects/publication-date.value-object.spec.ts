import { expect, it } from 'vitest';
import { PublicationDate } from './publication-date.value-object.js';

it('accepts no date at all', () => {
    const year = null;

    const result = PublicationDate.from(year, null);

    expect(result).toBeNull();
});

it('accepts a year alone', () => {
    const year = 2020;

    const result = PublicationDate.from(year, null);

    expect(result).toMatchObject({ year: 2020, month: null });
});

it('accepts a month with its year', () => {
    const year = 2020;

    const result = PublicationDate.from(year, 9);

    expect(result).toMatchObject({ year: 2020, month: 9 });
});

it('rejects a month without a year', () => {
    const month = 9;

    const operation = () => PublicationDate.from(null, month);

    expect(operation).toThrow(
        expect.objectContaining({ reason: 'publication-month-without-year' }),
    );
});

it('rejects a month outside the year', () => {
    const month = 13;

    const operation = () => PublicationDate.from(2020, month);

    expect(operation).toThrow(expect.objectContaining({ reason: 'publication-month-invalid' }));
});

it('rejects a fractional year', () => {
    const year = 2020.5;

    const operation = () => PublicationDate.from(year, null);

    expect(operation).toThrow(expect.objectContaining({ reason: 'publication-year-invalid' }));
});
