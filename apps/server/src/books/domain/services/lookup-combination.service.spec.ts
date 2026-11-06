import { describe, expect, it } from 'vitest';
import type { LookupAnswerFields } from '../value-objects/lookup-answer.value-object.js';
import { LookupAnswer } from '../value-objects/lookup-answer.value-object.js';
import { LookupCombination } from './lookup-combination.service.js';

function combine(...answers: [string, LookupAnswerFields][]) {
    const combination = new LookupCombination();

    for (const [source, fields] of answers) {
        combination.add(source, LookupAnswer.of(fields));
    }

    return combination;
}

describe('LookupCombination', () => {
    it('completes a field the preferred source lacks from the next one (example 18)', () => {
        const combination = combine(
            ['bnf', { title: 'Piranesi' }],
            ['openlibrary', { pageCount: 272 }],
        );

        const result = combination.result();

        expect(result.title).toEqual([{ value: 'Piranesi', sources: ['bnf'] }]);
        expect(result.pageCount).toEqual([{ value: 272, sources: ['openlibrary'] }]);
    });

    it('offers a different value after the preferred one (example 18)', () => {
        const combination = combine(
            ['bnf', { publisher: 'Librairie générale française' }],
            ['openlibrary', { publisher: 'Le livre de poche' }],
        );

        const result = combination.result();

        expect(result.publisher).toEqual([
            { value: 'Librairie générale française', sources: ['bnf'] },
            { value: 'Le livre de poche', sources: ['openlibrary'] },
        ]);
    });

    it('merges values that differ only by case, accents and punctuation', () => {
        const combination = combine(
            ['bnf', { title: 'Rose hip Rose. 1', publisher: 'Glénat' }],
            ['openlibrary', { title: 'ROSE HIP ROSE 1', publisher: 'glenat' }],
        );

        const result = combination.result();

        expect(result.title).toEqual([
            { value: 'Rose hip Rose. 1', sources: ['bnf', 'openlibrary'] },
        ]);
        expect(result.publisher).toEqual([{ value: 'Glénat', sources: ['bnf', 'openlibrary'] }]);
    });

    it('merges the same authors written in another order', () => {
        const combination = combine(
            ['bnf', { authors: ['Fujisawa Tooru', 'Kiyoshi Nagai'] }],
            ['openlibrary', { authors: ['Kiyoshi Nagai', 'Tooru Fujisawa'] }],
        );

        const result = combination.result();

        expect(result.authors).toEqual([
            { value: ['Fujisawa Tooru', 'Kiyoshi Nagai'], sources: ['bnf', 'openlibrary'] },
        ]);
    });

    it('keeps a summary written in the edition language', () => {
        const combination = combine(
            ['bnf', { editionLanguage: 'fre' }],
            ['google', { summary: { text: 'Un garçon…', language: 'fr' } }],
        );

        const result = combination.result();

        expect(result.summary).toEqual([{ value: 'Un garçon…', sources: ['google'] }]);
    });

    it('leaves out a summary in another language than the edition (example 19)', () => {
        const combination = combine(
            ['bnf', { editionLanguage: 'fre' }],
            ['google', { summary: { text: 'A boy…', language: 'en' } }],
        );

        const result = combination.result();

        expect(result.summary).toEqual([]);
    });

    it('keeps the English summary of an English edition (example 19)', () => {
        const combination = combine([
            'google',
            { editionLanguage: 'eng', summary: { text: 'A boy…', language: 'en' } },
        ]);

        const result = combination.result();

        expect(result.summary).toEqual([{ value: 'A boy…', sources: ['google'] }]);
    });

    it('leaves out a summary when the edition language is unknown', () => {
        const combination = combine(['google', { summary: { text: 'A boy…', language: 'en' } }]);

        const result = combination.result();

        expect(result.summary).toEqual([]);
    });

    it('suggests the collection and volume a source names', () => {
        const combination = combine(
            ['bnf', { series: { name: 'Rose hip Rose', volume: 1 } }],
            ['openlibrary', { series: { name: 'Rose Hip Rose', volume: 1 } }],
        );

        const result = combination.result();

        expect(result.collection).toEqual([
            { value: { name: 'Rose hip Rose', volume: 1 }, sources: ['bnf', 'openlibrary'] },
        ]);
    });

    it('found nothing when every answer is empty', () => {
        const combination = combine(['bnf', { editionLanguage: 'fre' }]);

        expect(combination.found).toBe(false);
    });

    it('found something with one usable answer', () => {
        const combination = combine(['bnf', {}], ['openlibrary', { title: 'Piranesi' }]);

        expect(combination.found).toBe(true);
    });
});
