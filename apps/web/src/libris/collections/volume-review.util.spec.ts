import { describe, expect, it } from 'vitest';
import type { MissingVolumeEditionDto } from '../../../../../packages/contracts/src/http';
import type { FoundVolumes } from './volume-review.util';
import { VolumeReview } from './volume-review.util';

function edition(
    isbn13: string,
    changes: Partial<MissingVolumeEditionDto> = {},
): MissingVolumeEditionDto {
    return {
        isbn13,
        title: 'Gunnm. ' + isbn13.slice(-2),
        subtitle: null,
        authors: ['Yukito Kishiro'],
        publisher: 'Glénat',
        publicationYear: 2001,
        pageCount: 200,
        summary: 'Gally',
        inLibrary: false,
        ...changes,
    };
}

function found(rows: FoundVolumes['rows']): FoundVolumes {
    return {
        kind: 'found',
        collection: { id: 'gunnm', name: 'Gunnm', category: 'manga' },
        anchor: { bookId: 'book-1', volume: 1 },
        series: 'Gunnm',
        rows,
    };
}

const gunnm = found([
    {
        volume: 2,
        generatedTitle: 'Gunnm Vol. 2',
        editions: [
            edition('9782723434324', { inLibrary: true }),
            edition('9782344017524', { title: 'La vierge de fer' }),
        ],
    },
    { volume: 3, generatedTitle: 'Gunnm Vol. 3', editions: [] },
    { volume: 4, generatedTitle: 'Gunnm Vol. 4', editions: [edition('9782723434782')] },
]);

describe('VolumeReview', () => {
    it('ticks every volume found, on its best edition not already in the library', () => {
        const choices = VolumeReview.initial(gunnm);

        expect(choices).toEqual([
            {
                volume: 2,
                ticked: true,
                isbn13: '9782344017524',
                ownership: 'owned',
                sourceTitle: false,
            },
            { volume: 3, ticked: false, isbn13: null, ownership: 'owned', sourceTitle: false },
            {
                volume: 4,
                ticked: true,
                isbn13: '9782723434782',
                ownership: 'owned',
                sourceTitle: false,
            },
        ]);
    });

    it('takes the source title of a Books collection', () => {
        const books = found([
            { volume: 2, generatedTitle: null, editions: [edition('9782344017524')] },
        ]);

        const choices = VolumeReview.initial(books);

        expect(choices[0]?.sourceTitle).toBe(true);
        expect(VolumeReview.title(books.rows[0]!, choices[0]!)).toBe('Gunnm. 24');
    });

    it('asks for the ticked volumes only, generated title left to the server', () => {
        const choices = VolumeReview.initial(gunnm);

        choices[2] = { ...choices[2]!, ticked: false };
        const request = VolumeReview.request(gunnm, choices);

        expect(request).toEqual({
            collectionId: 'gunnm',
            anchorBookId: 'book-1',
            volumes: [
                {
                    volume: 2,
                    isbn: '9782344017524',
                    ownership: 'owned',
                    title: null,
                    authors: ['Yukito Kishiro'],
                    publicationYear: 2001,
                    pageCount: 200,
                    summary: 'Gally',
                },
            ],
        });
    });

    it('sends the source title the person chose and the ownership of each row', () => {
        const choices = VolumeReview.initial(gunnm);

        choices[0] = { ...choices[0]!, sourceTitle: true, ownership: 'not-owned' };
        const request = VolumeReview.request(gunnm, choices);

        expect(request.volumes[0]).toMatchObject({
            title: 'La vierge de fer',
            ownership: 'not-owned',
        });
        expect(VolumeReview.title(gunnm.rows[0]!, choices[0]!)).toBe('La vierge de fer');
    });

    it('lists the covers to fetch for the chosen editions, in order', () => {
        const choices = VolumeReview.initial(gunnm);

        const covers = VolumeReview.covers(gunnm, choices);

        expect(covers).toEqual(['9782344017524', '9782723434782']);
    });
});
