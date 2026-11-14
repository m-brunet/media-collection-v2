import { describe, expect, it } from 'vitest';
import { LookupAnswer } from '../value-objects/lookup-answer.value-object.js';
import type { LookupAnswerFields } from '../value-objects/lookup-answer.value-object.js';
import { SeriesVolumes } from './series-volumes.service.js';
import type { SeriesEntry } from './series-volumes.service.js';

function entry(
    isbn: string,
    fields: LookupAnswerFields,
    subtitle: string | null = null,
): SeriesEntry {
    return { isbns: [isbn], subtitle, answer: LookupAnswer.of({ publisher: 'Glénat', ...fields }) };
}

function volume(isbn: string, number: number, year: number, subtitle: string | null = null) {
    return entry(
        isbn,
        {
            title: 'Gunnm. ' + number,
            series: { name: 'Gunnm', volume: number },
            publicationDate: { year, month: null },
        },
        subtitle,
    );
}

const anchorEntry = volume('9782723434799', 5, 2001);

function anchored(entries: readonly SeriesEntry[]) {
    const anchor = SeriesVolumes.anchorOf([anchorEntry], [{ isbn13: '9782723434799', volume: 5 }]);

    return SeriesVolumes.of(anchor!, entries);
}

describe('SeriesVolumes', () => {
    it('takes the highest owned volume the catalogue knows as the anchor', () => {
        const entries = [volume('9782723432931', 1, 2000), anchorEntry];

        const anchor = SeriesVolumes.anchorOf(entries, [
            { isbn13: '9782723432931', volume: 1 },
            { isbn13: '9782723434799', volume: 5 },
            { isbn13: '9782344068922', volume: 9 },
        ]);

        expect(anchor).toMatchObject({ isbn13: '9782723434799', volume: 5 });
    });

    it('takes no anchor without a series or a publisher', () => {
        const entries = [
            entry('9782723434799', { title: 'Gunnm', publisher: null }),
            entry('9782723432931', { series: { name: 'Gunnm', volume: 1 }, publisher: null }),
        ];

        const anchor = SeriesVolumes.anchorOf(entries, [
            { isbn13: '9782723434799', volume: 5 },
            { isbn13: '9782723432931', volume: 1 },
        ]);

        expect(anchor).toBeNull();
    });

    it("ranks the anchor's edition first, by ISBN prefix and then by year", () => {
        const volumes = anchored([
            volume('9782344017517', 1, 2016),
            volume('9782723419000', 1, 1995),
            volume('9782723432931', 1, 2000),
        ]);

        const editions = volumes.editions(1).map((edition) => edition.isbn13);

        expect(editions).toEqual(['9782723432931', '9782723419000', '9782344017517']);
    });

    it("ranks an edition with another subtitle than the anchor's after the others", () => {
        const volumes = anchored([
            volume('9782723434782', 4, 2001, 'Mars chronicle'),
            volume('9782344025253', 4, 2017),
        ]);

        const editions = volumes.editions(4).map((edition) => edition.isbn13);

        expect(editions).toEqual(['9782344025253', '9782723434782']);
    });

    it('keeps only the exact series, ignoring case and accents', () => {
        const volumes = anchored([
            entry('9782723439800', { series: { name: 'Gunnm last order', volume: 1 } }),
            entry('9782723432931', { series: { name: 'GUNNM', volume: 1 } }),
        ]);

        const editions = volumes.editions(1).map((edition) => edition.isbn13);

        expect(editions).toEqual(['9782723432931']);
    });

    it('reads the volume at the end of a title that starts with the series', () => {
        const volumes = anchored([
            entry('9782344068922', { title: 'Gunnm - Édition originale - Tome 12' }),
            entry('9782344071120', { title: 'Gunnm and friends' }),
        ]);

        expect(volumes.editions(12).map((edition) => edition.isbn13)).toEqual(['9782344068922']);
    });

    it('keeps one edition per ISBN, read from an ISBN-10 as well', () => {
        const volumes = anchored([
            volume('2-7234-3293-9', 1, 2000),
            volume('9782723432931', 1, 2000),
            entry('', { series: { name: 'Gunnm', volume: 1 } }),
        ]);

        expect(volumes.editions(1).map((edition) => edition.isbn13)).toEqual(['9782723432931']);
    });

    it('finds no edition for a volume the catalogue does not list', () => {
        const volumes = anchored([volume('9782723432931', 1, 2000)]);

        expect(volumes.editions(2)).toEqual([]);
    });
});
