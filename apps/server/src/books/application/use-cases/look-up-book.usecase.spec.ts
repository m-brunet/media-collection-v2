import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoverOffer } from '../../domain/services/cover-combination.service.js';
import type { LookupAnswerFields } from '../../domain/value-objects/lookup-answer.value-object.js';
import { LookupAnswer } from '../../domain/value-objects/lookup-answer.value-object.js';
import type { SourceReply } from '../ports/driven/lookup-source.interface.js';
import { AuthorMatcher } from '../services/author-matcher.service.js';
import { SourceLink } from '../services/source-chain.service.js';
import {
    BookDoubles,
    guest,
    ManualClock,
    MemoryCoverRegistry,
    owner,
    ScriptedSource,
} from '../testing/book-doubles.test-support.js';
import { Author } from '../../domain/entities/author.entity.js';
import { LookUpBook } from './look-up-book.usecase.js';

const clock = new ManualClock();

function chain<T>(...sources: ScriptedSource<T>[]): SourceLink<T> | null {
    return SourceLink.chain(sources, clock);
}

afterEach(() => {
    vi.useRealTimers();
});

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
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
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
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
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
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
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
            pending: [],
        });
    });

    it('tells no result apart from unavailable sources (example 13)', async () => {
        const bnf = new ScriptedSource<LookupAnswer>('bnf', { kind: 'none' });

        const result = await new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
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
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
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

    it('names a source whose queue is too long as busy', async () => {
        const bnf = new ScriptedSource<LookupAnswer>('bnf', { kind: 'busy' });

        const result = await new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        ).execute(owner, '9782253164692');

        expect(result).toMatchObject({
            found: false,
            unavailable: [{ source: 'bnf', reason: 'busy' }],
        });
    });

    it('answers after ten seconds with what has arrived, naming the sources still answering', async () => {
        vi.useFakeTimers();
        const bnf = new ScriptedSource('bnf', answer({ title: 'Piranesi' }));
        const sudoc = new ScriptedSource<LookupAnswer>('sudoc', 'hang');
        const covers = new ScriptedSource<CoverOffer[]>('inventaire', 'hang');
        const lookup = new LookUpBook(
            BookDoubles.library().books,
            chain(bnf, sudoc),
            chain(covers),
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        );

        const answered = lookup.execute(owner, '9782253164692');

        await vi.advanceTimersByTimeAsync(LookUpBook.answerSeconds * 1000);
        const result = await answered;

        expect(result).toMatchObject({
            found: true,
            fields: { title: [{ value: 'Piranesi', sources: ['bnf'] }] },
            unavailable: [],
            pending: ['sudoc', 'inventaire'],
        });
    });

    it('does not answer before ten seconds while a source is still answering', async () => {
        vi.useFakeTimers();
        const bnf = new ScriptedSource<LookupAnswer>('bnf', 'hang');
        let answered = false;

        void new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        )
            .execute(owner, '9782253164692')
            .then(() => {
                answered = true;
            });
        await vi.advanceTimersByTimeAsync(LookUpBook.answerSeconds * 1000 - 1);

        expect(answered).toBe(false);
    });

    it('names a source once when its information and its cover are both late', async () => {
        vi.useFakeTimers();
        const information = new ScriptedSource<LookupAnswer>('openlibrary', 'hang');
        const covers = new ScriptedSource<CoverOffer[]>('openlibrary', 'hang');
        const lookup = new LookUpBook(
            BookDoubles.library().books,
            chain(information),
            chain(covers),
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        );

        const answered = lookup.execute(owner, '9782253164692');

        await vi.advanceTimersByTimeAsync(LookUpBook.answerSeconds * 1000);
        const result = await answered;

        expect(result).toMatchObject({ found: false, pending: ['openlibrary'] });
    });

    it('joins a late request on Check again instead of sending it twice', async () => {
        vi.useFakeTimers();
        const sudoc = new ScriptedSource<LookupAnswer>('sudoc', 'hang');
        const lookup = new LookUpBook(
            BookDoubles.library().books,
            chain(sudoc),
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        );
        const first = lookup.execute(owner, '9782253164692');

        await vi.advanceTimersByTimeAsync(LookUpBook.answerSeconds * 1000);
        await first;

        const again = lookup.execute(owner, '9782253164692');

        await vi.advanceTimersByTimeAsync(LookUpBook.answerSeconds * 1000);
        await again;

        expect(sudoc.requests).toHaveLength(1);
    });

    it('gives an answered lookup again from the cache, without a new request', async () => {
        const bnf = new ScriptedSource('bnf', answer({ title: 'Piranesi' }));
        const lookup = new LookUpBook(
            BookDoubles.library().books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        );

        await lookup.execute(owner, '9782253164692');

        const result = await lookup.execute(owner, '9782253164692');

        expect(result).toMatchObject({ found: true, pending: [] });
        expect(bnf.requests).toHaveLength(1);
    });

    it('offers the cover kept for the ISBN, without asking any cover source', async () => {
        const current = BookDoubles.library();
        const file = await current.covers.store(new Uint8Array([1]), 'image/png');
        const covers = new ScriptedSource<CoverOffer[]>('inventaire', {
            kind: 'found',
            value: [cover],
        });
        const registry = new MemoryCoverRegistry();

        await current.kept.keep('9782253164692', file);

        const result = await new LookUpBook(
            current.books,
            null,
            chain(covers),
            registry,
            new AuthorMatcher(current.authors),
            current.kept,
            current.publishers,
        ).execute(owner, '9782253164692');

        expect(result).toMatchObject({
            found: true,
            covers: [{ token: 'lookup-cover-1', sources: ['libris'] }],
        });
        expect(registry.address('lookup-cover-1')).toBe('kept:' + file);
        expect(covers.asked).toEqual([]);
    });

    it('still asks the information sources when a cover is kept for the ISBN', async () => {
        const current = BookDoubles.library();
        const file = await current.covers.store(new Uint8Array([1]), 'image/png');
        const bnf = new ScriptedSource('bnf', answer({ title: 'Piranesi' }));

        await current.kept.keep('9782253164692', file);

        await new LookUpBook(
            current.books,
            chain(bnf),
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(current.authors),
            current.kept,
            current.publishers,
        ).execute(owner, '9782253164692');

        expect(bnf.asked).toEqual(['9782253164692']);
    });

    it('rejects an invalid ISBN', async () => {
        const lookup = new LookUpBook(
            BookDoubles.library().books,
            null,
            null,
            new MemoryCoverRegistry(),
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
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
            new AuthorMatcher(BookDoubles.library().authors),
            BookDoubles.library().kept,
            BookDoubles.library().publishers,
        ).execute(guest, '9782253164692');

        await expect(result).rejects.toMatchObject({ reason: 'guest-read-only' });
        expect(bnf.asked).toEqual([]);
    });

    describe('with an existing author', () => {
        async function lookUp(...sources: ScriptedSource<LookupAnswer>[]) {
            const { books, authors } = BookDoubles.library();

            await authors.create(
                new Author({ id: 'a1', name: "Flipflop's", createdAt: '2026-03-01T10:00:00Z' }),
            );

            return new LookUpBook(
                books,
                chain(...sources),
                null,
                new MemoryCoverRegistry(),
                new AuthorMatcher(authors),
                BookDoubles.library().kept,
                BookDoubles.library().publishers,
            ).execute(owner, '9782253164692');
        }

        it("fills in the existing author's name instead of a similar spelling", async () => {
            const bnf = new ScriptedSource(
                'bnf',
                answer({ authors: ['Flipsflops', 'Yuki Kodama'] }),
            );

            const result = await lookUp(bnf);

            expect(result).toMatchObject({
                fields: { authors: [{ value: ["Flipflop's", 'Yuki Kodama'], sources: ['bnf'] }] },
                authorSpellings: [{ name: "Flipflop's", spelling: 'Flipsflops', sources: ['bnf'] }],
            });
        });

        it("merges the sources' spellings of the same existing author", async () => {
            const bnf = new ScriptedSource('bnf', answer({ authors: ['Flipsflops'] }));
            const openLibrary = new ScriptedSource(
                'openlibrary',
                answer({ authors: ["Flipflop's"] }),
            );

            const result = await lookUp(bnf, openLibrary);

            expect(result).toMatchObject({
                fields: { authors: [{ value: ["Flipflop's"], sources: ['bnf', 'openlibrary'] }] },
                authorSpellings: [{ name: "Flipflop's", spelling: 'Flipsflops', sources: ['bnf'] }],
            });
        });

        it("fills in an existing author's name as saved, even with a final period", async () => {
            const { books, authors, kept, publishers } = BookDoubles.library();
            const bnf = new ScriptedSource('bnf', answer({ authors: ['Franquin.'] }));

            await authors.create(
                new Author({ id: 'a2', name: 'Franquin.', createdAt: '2026-03-01T10:00:00Z' }),
            );

            const result = await new LookUpBook(
                books,
                chain(bnf),
                null,
                new MemoryCoverRegistry(),
                new AuthorMatcher(authors),
                kept,
                publishers,
            ).execute(owner, '9782253164692');

            expect(result).toMatchObject({
                fields: { authors: [{ value: ['Franquin.'], sources: ['bnf'] }] },
            });
        });

        it('offers no other spelling for the same name', async () => {
            const bnf = new ScriptedSource('bnf', answer({ authors: ["FLIPFLOP'S"] }));

            const result = await lookUp(bnf);

            expect(result).toMatchObject({ authorSpellings: [] });
        });
    });

    describe('with an existing publisher', () => {
        async function lookUp(...sources: ScriptedSource<LookupAnswer>[]) {
            const current = BookDoubles.library();

            await BookDoubles.saved(current, { publisher: 'Glénat', isbn: '9780306406157' });

            return new LookUpBook(
                current.books,
                chain(...sources),
                null,
                new MemoryCoverRegistry(),
                new AuthorMatcher(current.authors),
                current.kept,
                current.publishers,
            ).execute(owner, '9782253164692');
        }

        it("fills in a source's publisher under the existing spelling of its key", async () => {
            const bnf = new ScriptedSource('bnf', answer({ publisher: 'GLENAT' }));

            const result = await lookUp(bnf);

            expect(result).toMatchObject({
                fields: { publisher: [{ value: 'Glénat', sources: ['bnf'] }] },
            });
        });

        it("fills in the publisher's collection under the existing spelling too", async () => {
            const bnf = new ScriptedSource(
                'bnf',
                answer({ publisher: 'Kana', publisherCollection: 'glenat' }),
            );

            const result = await lookUp(bnf);

            expect(result).toMatchObject({
                fields: {
                    publisher: [
                        { value: 'Kana', sources: ['bnf'] },
                        { value: 'Glénat', sources: ['bnf'] },
                    ],
                },
            });
        });

        it("does not offer a source's own spelling of an existing publisher", async () => {
            const bnf = new ScriptedSource('bnf', answer({ publisher: 'GLENAT' }));
            const openLibrary = new ScriptedSource('openlibrary', answer({ publisher: 'Glénat' }));

            const result = await lookUp(bnf, openLibrary);

            expect(result).toMatchObject({
                fields: { publisher: [{ value: 'Glénat', sources: ['bnf', 'openlibrary'] }] },
            });
        });

        it('leaves a close spelling as the source wrote it', async () => {
            const bnf = new ScriptedSource('bnf', answer({ publisher: 'Glénatt' }));

            const result = await lookUp(bnf);

            expect(result).toMatchObject({
                fields: { publisher: [{ value: 'Glénatt', sources: ['bnf'] }] },
            });
        });
    });
});
