import type {
    AuthorChoiceDto,
    BookBatchChangesDto,
    BookBatchFieldsDto,
    BookBatchSkipReason,
    BookCategory,
    BookOwnership,
    CollectionDetailsDto,
    CollectionMemberDto,
} from '../../../../../packages/contracts/src/http';
import type { DraftAuthor, DraftTag } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';

export type TextChoice = { mode: 'keep' | 'set' | 'clear'; value: string };

export interface BatchDraft {
    category: BookCategory | 'keep';
    ownership: BookOwnership | 'keep';
    publisher: TextChoice;
    price: TextChoice;
    shelf: { mode: 'keep' | 'set' | 'clear'; bookcaseId: string | null; shelfId: string | null };
    addTags: DraftTag[];
    removeTags: DraftTag[];
    replaceAuthors: boolean;
    authors: DraftAuthor[];
    read: 'keep' | 'read' | 'not-read';
    generatedTitles: boolean;
}

export type BatchProblem = 'nothing' | 'publisher' | 'price' | 'shelf' | 'authors';

export type Shown = { text: string } | { key: MessageKey };

export type ChangeLine = { label: MessageKey; before: Shown; after: Shown };

type Field = keyof BookBatchFieldsDto;

const fieldLabels: Partial<Record<Field, MessageKey>> = {
    category: 'form.category',
    ownership: 'form.ownership',
    publisher: 'form.publisher',
    priceCents: 'batch.price',
    authors: 'form.authors',
    location: 'batch.location',
    tags: 'tags.field',
    read: 'form.reading',
};
const skipReasons: Record<BookBatchSkipReason, MessageKey> = {
    'book-lent': 'batch.skip.lent',
    'possible-duplicate': 'batch.skip.duplicate',
    'title-not-generated': 'batch.skip.books',
};

export class CollectionBatch {
    static draft(): BatchDraft {
        return {
            category: 'keep',
            ownership: 'keep',
            publisher: { mode: 'keep', value: '' },
            price: { mode: 'keep', value: '' },
            shelf: { mode: 'keep', bookcaseId: null, shelfId: null },
            addTags: [],
            removeTags: [],
            replaceAuthors: false,
            authors: [],
            read: 'keep',
            generatedTitles: false,
        };
    }

    static books(collection: CollectionDetailsDto): CollectionMemberDto[] {
        const books = new Map<string, CollectionMemberDto>();

        for (const volume of collection.volumes) {
            for (const book of volume.books) {
                books.set(book.id, book);
            }
        }

        return [...books.values()].sort(
            (first, second) =>
                first.volumeFrom - second.volumeFrom || first.title.localeCompare(second.title),
        );
    }

    static owned(collection: CollectionDetailsDto): string[] {
        return CollectionBatch.books(collection)
            .filter((book) => book.ownership === 'owned')
            .map((book) => book.id);
    }

    static problem(draft: BatchDraft): BatchProblem | null {
        if (draft.publisher.mode === 'set' && !draft.publisher.value.trim()) {
            return 'publisher';
        }

        if (draft.price.mode === 'set' && !draft.price.value.trim()) {
            return 'price';
        }

        if (draft.shelf.mode === 'set' && !draft.shelf.shelfId) {
            return 'shelf';
        }

        if (draft.replaceAuthors && draft.authors.length === 0) {
            return 'authors';
        }

        return Object.keys(CollectionBatch.changes(draft)).length === 0 ? 'nothing' : null;
    }

    static changes(draft: BatchDraft): BookBatchChangesDto {
        const changes: BookBatchChangesDto = {};

        if (draft.category !== 'keep') {
            changes.category = draft.category;
        }

        if (draft.ownership !== 'keep') {
            changes.ownership = draft.ownership;
        }

        if (draft.publisher.mode !== 'keep') {
            changes.publisher = CollectionBatch.text(draft.publisher);
        }

        if (draft.price.mode !== 'keep') {
            changes.price = CollectionBatch.text(draft.price);
        }

        if (draft.shelf.mode !== 'keep') {
            changes.shelfId = draft.shelf.mode === 'clear' ? null : draft.shelf.shelfId;
        }

        if (draft.addTags.length > 0 || draft.removeTags.length > 0) {
            changes.tags = {
                add: draft.addTags.flatMap((tag) => tag.id ?? []),
                remove: draft.removeTags.flatMap((tag) => tag.id ?? []),
            };
        }

        if (draft.replaceAuthors && draft.authors.length > 0) {
            changes.authors = draft.authors.map((author): AuthorChoiceDto =>
                author.id
                    ? { id: author.id }
                    : { name: author.name, ...(author.distinct ? { distinct: true } : {}) },
            );
        }

        if (draft.read !== 'keep') {
            changes.read = draft.read === 'read';
        }

        if (draft.generatedTitles) {
            changes.generatedTitles = true;
        }

        return changes;
    }

    static resolveAuthor(
        draft: BatchDraft,
        typedName: string,
        choice: { id: string; name: string } | 'distinct',
    ): BatchDraft {
        const key = BookDraft.nameKey(typedName);

        return {
            ...draft,
            authors: draft.authors.map((author) =>
                author.id === null && BookDraft.nameKey(author.name) === key
                    ? choice === 'distinct'
                        ? { ...author, distinct: true }
                        : { id: choice.id, name: choice.name, distinct: false }
                    : author,
            ),
        };
    }

    static lines(
        before: BookBatchFieldsDto,
        after: BookBatchFieldsDto,
        locale: string,
    ): ChangeLine[] {
        const lines: ChangeLine[] = [];

        if ('title' in after) {
            lines.push({
                label: 'form.title',
                before: { text: before.title ?? '' },
                after: { text: after.title ?? '' },
            });
        } else if ('titleGenerated' in after && !after.titleGenerated) {
            lines.push({
                label: 'form.title',
                before: { key: 'batch.generated' },
                after: { key: 'batch.kept' },
            });
        }

        for (const field of Object.keys(fieldLabels) as Field[]) {
            if (field in after) {
                lines.push({
                    label: fieldLabels[field]!,
                    before: CollectionBatch.value(field, before, locale),
                    after: CollectionBatch.value(field, after, locale),
                });
            }
        }

        return lines;
    }

    static skipReason(reason: BookBatchSkipReason): MessageKey {
        return skipReasons[reason];
    }

    private static value(field: Field, fields: BookBatchFieldsDto, locale: string): Shown {
        switch (field) {
            case 'category':
                return { key: BookFormat.category(fields.category!) };
            case 'ownership':
                return { key: BookFormat.ownership(fields.ownership!) };
            case 'read':
                return { key: BookFormat.reading(fields.read!) };
            case 'publisher':
                return fields.publisher ? { text: fields.publisher } : { key: 'batch.none' };
            case 'priceCents':
                return fields.priceCents === null || fields.priceCents === undefined
                    ? { key: 'batch.none' }
                    : { text: BookFormat.price(fields.priceCents, locale) };
            case 'authors':
                return { text: (fields.authors ?? []).join(', ') };
            case 'location':
                return fields.location
                    ? { text: fields.location.bookcaseName + ' · ' + fields.location.shelfName }
                    : { key: 'batch.noLocation' };
            default:
                return fields.tags && fields.tags.length > 0
                    ? { text: fields.tags.map((tag) => tag.name).join(', ') }
                    : { key: 'batch.none' };
        }
    }

    private static text(choice: TextChoice): string | null {
        return choice.mode === 'clear' ? null : choice.value.trim();
    }
}
