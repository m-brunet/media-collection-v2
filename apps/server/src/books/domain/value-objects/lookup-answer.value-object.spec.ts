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
        category: 'manga',
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
        category: 'manga',
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

it('drops a category a book cannot have', () => {
    const answer = LookupAnswer.of({ category: 'poems' as never });

    expect(answer.category).toBeNull();
});

it('is empty when the record holds nothing the form uses', () => {
    const answer = LookupAnswer.of({ editionLanguage: 'fre' });

    expect(answer.empty).toBe(true);
});

it('is empty with only a category', () => {
    const answer = LookupAnswer.of({ category: 'manga' });

    expect(answer.empty).toBe(true);
});

it('is not empty with a single usable value', () => {
    const answer = LookupAnswer.of({ pageCount: 256 });

    expect(answer.empty).toBe(false);
});

it('names other authors, keeping every other value', () => {
    const answer = LookupAnswer.of({ title: "Darwin's Game", authors: ['Flipsflops'] });

    const renamed = answer.withAuthors(["Flipflop's"]);

    expect(renamed).toMatchObject({ title: "Darwin's Game", authors: ["Flipflop's"] });
});

it("tidies the publisher's collection and drops an empty one", () => {
    const answers = [
        LookupAnswer.of({ publisherCollection: '  Le livre   de poche ' }),
        LookupAnswer.of({ publisherCollection: '   ' }),
    ];

    expect(answers.map((answer) => answer.publisherCollection)).toEqual([
        'Le livre de poche',
        null,
    ]);
});
it('respells the publisher and the publisher’s collection', () => {
    const answer = LookupAnswer.of({
        title: 'Gunnm',
        publisher: 'GLENAT',
        publisherCollection: 'Seinen',
    });

    const result = answer.withPublishers((publisher) => publisher.toLowerCase());

    expect(result).toMatchObject({
        title: 'Gunnm',
        publisher: 'glenat',
        publisherCollection: 'seinen',
    });
});
it('respells no publisher when the source gives none', () => {
    const answer = LookupAnswer.of({ title: 'Gunnm' });

    const result = answer.withPublishers(() => 'Glénat');

    expect(result).toMatchObject({ publisher: null, publisherCollection: null });
});

it('removes a final period from a title', () => {
    const answer = LookupAnswer.of({ title: 'Zorglub.' });

    expect(answer.title).toBe('Zorglub');
});

it('removes a final colon and its spaces from a series name', () => {
    const answer = LookupAnswer.of({ series: { name: 'Claymore :', volume: 1 } });

    expect(answer.series).toEqual({ name: 'Claymore', volume: 1 });
});

it('removes a final semicolon from a publisher', () => {
    const answer = LookupAnswer.of({ publisher: 'Glénat ;' });

    expect(answer.publisher).toBe('Glénat');
});

it('removes a final slash from a title', () => {
    const answer = LookupAnswer.of({ title: 'Akira /' });

    expect(answer.title).toBe('Akira');
});

it("removes a final equals sign from a publisher's collection", () => {
    const answer = LookupAnswer.of({ publisher: 'Kana', publisherCollection: 'Big Kana =' });

    expect(answer.publisherCollection).toBe('Big Kana');
});

it('removes a final comma from an author', () => {
    const answer = LookupAnswer.of({ authors: ['Hergé,'] });

    expect(answer.authors).toEqual(['Hergé']);
});

it('removes several endings in a row', () => {
    const answer = LookupAnswer.of({ title: 'Zorglub. :' });

    expect(answer.title).toBe('Zorglub');
});

it('names once an author written with and without a final period', () => {
    const answer = LookupAnswer.of({ authors: ['Franquin.', 'Franquin'] });

    expect(answer.authors).toEqual(['Franquin']);
});

it('keeps an ellipsis written with three periods', () => {
    const answer = LookupAnswer.of({ title: 'Et après...' });

    expect(answer.title).toBe('Et après...');
});

it('keeps an ellipsis written as one character', () => {
    const answer = LookupAnswer.of({ title: 'Et après…' });

    expect(answer.title).toBe('Et après…');
});

it('keeps the period of initials', () => {
    const answer = LookupAnswer.of({ authors: ['Tolkien, J. R. R.', 'J.R.R.'] });

    expect(answer.authors).toEqual(['Tolkien, J. R. R.', 'J.R.R.']);
});

it('keeps the period of a one-letter abbreviation', () => {
    const answer = LookupAnswer.of({ title: 'S.O.S.' });

    expect(answer.title).toBe('S.O.S.');
});

it('keeps a closing exclamation mark, question mark, parenthesis and bracket', () => {
    const answer = LookupAnswer.of({
        title: 'Yotsuba & !',
        publisher: 'Quoi ?',
        publisherCollection: 'Kana (Big)',
        series: { name: 'Akira [couleur]', volume: 1 },
    });

    expect(answer).toMatchObject({
        title: 'Yotsuba & !',
        publisher: 'Quoi ?',
        publisherCollection: 'Kana (Big)',
        series: { name: 'Akira [couleur]', volume: 1 },
    });
});

it('keeps a period inside a value', () => {
    const answer = LookupAnswer.of({ title: 'Mr. Nobody', series: { name: 'Vol. 2', volume: 2 } });

    expect(answer).toMatchObject({ title: 'Mr. Nobody', series: { name: 'Vol. 2', volume: 2 } });
});

it('leaves the summary as the source wrote it', () => {
    const answer = LookupAnswer.of({ summary: { text: 'Une enquête :', language: 'fre' } });

    expect(answer.summary?.text).toBe('Une enquête :');
});

it('gives no value for a text made only of endings', () => {
    const answer = LookupAnswer.of({ title: ' . : ', series: { name: ';', volume: 1 } });

    expect(answer).toMatchObject({ title: null, series: null });
});

it('keeps the period of a publisher abbreviation', () => {
    const answer = LookupAnswer.of({
        publisher: 'Pika éd.',
        publisherCollection: 'Dargaud & Cie.',
    });

    expect(answer).toMatchObject({ publisher: 'Pika éd.', publisherCollection: 'Dargaud & Cie.' });
});

it('keeps the period of Jr. after an author', () => {
    const answer = LookupAnswer.of({ authors: ['Robert Downey Jr.'] });

    expect(answer.authors).toEqual(['Robert Downey Jr.']);
});
