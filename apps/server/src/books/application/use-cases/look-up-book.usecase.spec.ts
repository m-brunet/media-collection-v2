import { describe, expect, it } from 'vitest';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import type { LookupAnswerFields } from '../../domain/value-objects/lookup-answer.value-object.js';
import { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { SourceBudget } from '../services/source-budget.service.js';
import { SourceLink } from '../services/source-chain.service.js';
import {
    BookDoubles,
    guest,
    ManualClock,
    MemoryCoverRegistry,
    owner,
    ScriptedSource,
} from '../testing/book-doubles.test-support.js';
import { LookUpBook } from './look-up-book.usecase.js';

const clock = new ManualClock();

function chain<T>(...sources: ScriptedSource<T>[]): SourceLink<T> | null {
    return sources.reduceRight<SourceLink<T> | null>(
        (next, source) =>
            new SourceLink(source, new SourceBudget(source.limit, clock), clock, next),
        null,
    );
}

function answer(fields: LookupAnswerFields): SourceReply<LookupAnswer> {
    return { kind: 'found', value: LookupAnswer.of(fields) };
}

const cover: CoverOffer = {
    address: 'https://covers.example/1-L.jpg',
    width: 400,
    height: 600,
    fingerprint: null,
};

describe('LookUpBook', () => {
    it('opens an ISBN already in the library without asking any source (example 11)', async () => {
        const current = BookDoubles.library();
        const book = await BookDoubles.saved(current);
        const bnf = new ScriptedSource('bnf', answer({ title: 'Piranesi' }));

        const result = await new LookUpBook(
            current.books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
        ).execute(owner, '978-1-63557-563-7');

        expect(result).toEqual({ kind: 'existing', bookId: book.id });
        expect(bnf.asked).toEqual([]);
    });

    it('asks the sources with the ISBN-13 of an ISBN-10', async () => {
        const bnf = new ScriptedSource<LookupAnswer>('bnf', { kind: 'none' });

        await new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
        ).execute(owner, '2253164690');

        expect(bnf.asked).toEqual(['9782253164692']);
    });

    it('combines the sources and their covers for review (example 18)', async () => {
        const bnf = new ScriptedSource(
            'bnf',
            answer({ title: "D'un monde à l'autre", publisher: 'LGF' }),
        );
        const openLibrary = new ScriptedSource('openlibrary', answer({ pageCount: 257 }));
        const covers = new ScriptedSource<CoverOffer[]>('openlibrary', {
            kind: 'found',
            value: [cover],
        });

        const result = await new LookUpBook(
            BookDoubles.library().books,
            chain(bnf, openLibrary),
            chain(covers),
            new MemoryCoverRegistry(),
        ).execute(owner, '9782253164692');

        expect(result).toMatchObject({
            kind: 'looked-up',
            isbn13: '9782253164692',
            found: true,
            fields: {
                title: [{ value: "D'un monde à l'autre", sources: ['bnf'] }],
                publisher: [{ value: 'LGF', sources: ['bnf'] }],
                pageCount: [{ value: 257, sources: ['openlibrary'] }],
            },
            covers: [
                { token: 'lookup-cover-1', width: 400, height: 600, sources: ['openlibrary'] },
            ],
            unavailable: [],
        });
    });

    it('tells no result apart from unavailable sources (example 13)', async () => {
        const bnf = new ScriptedSource<LookupAnswer>('bnf', { kind: 'none' });

        const result = await new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
        ).execute(owner, '9782253164692');

        expect(result).toMatchObject({ kind: 'looked-up', found: false, unavailable: [] });
    });

    it('completes the lookup when a source is unavailable, naming it (example 20)', async () => {
        const bnf = new ScriptedSource<LookupAnswer>('bnf', 'fail');
        const openLibrary = new ScriptedSource('openlibrary', answer({ title: 'Piranesi' }));
        const covers = new ScriptedSource<CoverOffer[]>('openlibrary', {
            kind: 'limited',
            retryAt: null,
        });

        const result = await new LookUpBook(
            BookDoubles.library().books,
            chain(bnf, openLibrary),
            chain(covers),
            new MemoryCoverRegistry(),
        ).execute(owner, '9782253164692');

        expect(result).toMatchObject({
            found: true,
            fields: { title: [{ value: 'Piranesi', sources: ['openlibrary'] }] },
            unavailable: [
                { source: 'bnf', reason: 'failed' },
                { source: 'openlibrary', reason: 'limited' },
            ],
        });
    });

    it('rejects an invalid ISBN', async () => {
        const lookup = new LookUpBook(
            BookDoubles.library().books,
            null,
            null,
            new MemoryCoverRegistry(),
        );

        const result = lookup.execute(owner, '9782253164691');

        await expect(result).rejects.toMatchObject({ reason: 'isbn-invalid' });
    });

    it('refuses a Guest', async () => {
        const bnf = new ScriptedSource('bnf', answer({ title: 'Piranesi' }));

        const result = new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
        ).execute(guest, '9782253164692');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(bnf.asked).toEqual([]);
    });
});
