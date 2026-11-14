import { describe, expect, it } from 'vitest';
import type { VolumeToAdd } from '../ports/driving/add-volumes-use-case.interface.js';
import {
    BookDoubles,
    guest,
    MembershipVolumes,
    owner,
} from '../testing/book-doubles.test-support.js';
import { AddVolumes } from './add-volumes.usecase.js';

function useCase(current: ReturnType<typeof BookDoubles.library>) {
    return new AddVolumes(
        new MembershipVolumes(current.collections, current.books),
        current.loader,
        current.organisation,
        current.readings,
        current.books,
        current.creation,
        current.ids,
        current.operations,
    );
}

function row(volume: number, isbn: string, changes: Partial<VolumeToAdd> = {}): VolumeToAdd {
    return {
        volume,
        isbn,
        ownership: 'owned',
        title: null,
        authors: ['Yukito Kishiro'],
        publicationYear: 2001,
        pageCount: 200,
        summary: 'Gally ' + volume,
        ...changes,
    };
}

async function gunnm(category: 'manga' | 'books' = 'manga') {
    const current = BookDoubles.library();
    const anchor = await BookDoubles.saved(
        current,
        {
            title: category === 'books' ? 'Gunnm one' : '',
            isbn: '9782723432931',
            category,
            publisher: 'Glénat',
            authors: [{ name: 'Yukito Kishiro' }],
            collection: { collection: { name: 'Gunnm' }, volumeFrom: 1, volumeTo: 1 },
            shelfId: 'shelf-3',
            tags: [{ id: 'history' }],
        },
        true,
    );

    current.trail.entries.length = 0;
    current.collections.names.set(anchor.collection!.id, 'Gunnm');

    return { current, anchor, collectionId: anchor.collection!.id };
}

describe('AddVolumes', () => {
    it('refuses a Guest', async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = useCase(current).execute(guest, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324')],
        });

        await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    });

    it("gives each volume the anchor's category, publisher, shelf, tags and reading", async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324')],
        });
        const added = result.added[0]!;
        const book = await current.books.findById(added.bookId);

        expect(result).toEqual({
            added: [{ bookId: added.bookId, volume: 2, title: 'Gunnm Vol. 2' }],
            skipped: [],
        });
        expect(book?.details).toMatchObject({
            category: 'manga',
            publisher: 'Glénat',
            titleGenerated: true,
            pageCount: 200,
            summary: 'Gally 2',
            publicationDate: { year: 2001, month: null },
        });
        expect(current.shelving.placed.get(added.bookId)).toBe('shelf-3');
        expect((await current.tagging.of(added.bookId)).map((tag) => tag.id)).toEqual(['history']);
        expect(await current.readings.isRead(owner.id, added.bookId)).toBe(true);
        expect(book?.details.authorIds).toEqual(anchor.authors.map((author) => author.id));
    });

    it('takes the source title when the person chose it', async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324', { title: 'La vierge de fer' })],
        });

        expect(result.added[0]?.title).toBe('La vierge de fer');
    });

    it("takes the anchor's authors when the source gives none", async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324', { authors: [] })],
        });
        const book = await current.books.findById(result.added[0]!.bookId);

        expect(book?.details.authorIds).toEqual(anchor.authors.map((author) => author.id));
    });

    it('saves each volume with its own ownership', async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324'), row(3, '9782723434775', { ownership: 'not-owned' })],
        });
        const books = await Promise.all(
            result.added.map(({ bookId }) => current.books.findById(bookId)),
        );

        expect(books.map((book) => book?.details.ownership)).toEqual(['owned', 'not-owned']);
    });

    it('leaves out a volume taken meanwhile or an ISBN already saved, and saves the rest', async () => {
        const { current, anchor, collectionId } = await gunnm();

        await BookDoubles.saved(current, { isbn: '9782723434782' });

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(1, '9782723434324'), row(4, '9782723434782'), row(5, '9782723434799')],
        });

        expect(result.added.map((added) => added.volume)).toEqual([5]);
        expect(result.skipped).toEqual([
            { volume: 1, isbn: '9782723434324', reason: 'volume-taken' },
            { volume: 4, isbn: '9782723434782', reason: 'isbn-taken' },
        ]);
    });

    it('leaves out a second row for the same volume', async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324'), row(2, '9782723434775')],
        });

        expect(result.skipped).toEqual([
            { volume: 2, isbn: '9782723434775', reason: 'volume-taken' },
        ]);
    });

    it('records one operation on the collection with every book created', async () => {
        const { current, anchor, collectionId } = await gunnm();

        const result = await useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324'), row(3, '9782723434775')],
        });

        const operations = new Set(current.trail.entries.map((entry) => entry.operationId));
        const main = current.trail.entries.find(
            (entry) => entry.category === 'collection.volumes-added',
        );

        expect(operations.size).toBe(1);
        expect(main).toMatchObject({
            subjectType: 'collection',
            subjectId: collectionId,
            after: { name: 'Gunnm', added: result.added, skipped: [] },
        });
        expect(
            current.trail.entries
                .filter((entry) => entry.category === 'book.created')
                .map((entry) => entry.subjectId),
        ).toEqual(result.added.map((added) => added.bookId));
    });

    it('refuses an anchor outside the collection', async () => {
        const { current, collectionId } = await gunnm();
        const other = await BookDoubles.saved(current, { isbn: '9781635575637' });

        const result = useCase(current).execute(owner, {
            collectionId,
            anchorBookId: other.id,
            volumes: [row(2, '9782723434324')],
        });

        await expect(result).rejects.toMatchObject({ reason: 'anchor-outside-collection' });
    });

    it('asks for a title for every volume of a Books collection', async () => {
        const { current, anchor, collectionId } = await gunnm('books');

        const result = useCase(current).execute(owner, {
            collectionId,
            anchorBookId: anchor.id,
            volumes: [row(2, '9782723434324')],
        });

        await expect(result).rejects.toMatchObject({ reason: 'title-missing' });
    });
});
