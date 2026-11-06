import { expect, it } from 'vitest';
import { LookupAnswer } from './lookup-answer.value-object.js';

it('keeps the values a source gives, tidying spaces', () => {
    const answer = LookupAnswer.of({
        title: '  Rose hip   Rose ',
        authors: ['Tooru Fujisawa', ' Tooru Fujisawa', ''],
        publisher: 'Pika',
        publicationDate: { year: 2009, month: 10 },
        pageCount: 192,
        summary: { text: 'Une enquête.', language: 'FRE' },
        editionLanguage: 'fre',
        series: { name: 'Rose hip Rose', volume: 1 },
    });

    expect(answer).toMatchObject({
        title: 'Rose hip Rose',
        authors: ['Tooru Fujisawa'],
        publisher: 'Pika',
        publicationDate: { year: 2009, month: 10 },
        pageCount: 192,
        summary: { text: 'Une enquête.', language: 'fre' },
        editionLanguage: 'fre',
        series: { name: 'Rose hip Rose', volume: 1 },
    });
});

it('drops values a book cannot have', () => {
    const answer = LookupAnswer.of({
        title: ' ',
        publicationDate: { year: 2012, month: 13 },
        pageCount: 0,
        summary: { text: '  ', language: 'fre' },
        editionLanguage: 'French',
        series: { name: 'Claymore', volume: -1 },
    });

    expect(answer).toMatchObject({
        title: null,
        publicationDate: { year: 2012, month: null },
        pageCount: null,
        summary: null,
        editionLanguage: null,
        series: null,
    });
});

it('is empty when the record holds nothing the form uses', () => {
    const answer = LookupAnswer.of({ editionLanguage: 'fre' });

    expect(answer.empty).toBe(true);
});

it('is not empty with a single usable value', () => {
    const answer = LookupAnswer.of({ pageCount: 256 });

    expect(answer.empty).toBe(false);
});
