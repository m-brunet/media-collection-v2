import type {
    AuthorChoiceDto,
    BookBatchChangesDto,
    BookBatchDto,
    BookBatchFieldsDto,
    BookBatchFillable,
    BookBatchSkipReason,
    BookCategory,
    BookOwnership,
    CollectionDetailsDto,
} from '../../../../../packages/contracts/src/http';
import type { DraftAuthor, DraftTag } from '../../shared/book-form/book-draft.util';
import { BookDraft } from '../../shared/book-form/book-draft.util';
import { BookFormat } from '../../shared/book-form/book-format.util';
import type { MessageKey } from '../../shared/i18n/catalog-en';
import { CollectionCovers } from './collection-covers.util';
import { Required } from '../../shared/required.util';

export type ChoiceMode = 'keep' | 'set' | 'fill' | 'clear';

export type TextChoice = { mode: ChoiceMode; value: string };

export type BatchField =
    | 'category'
    | 'ownership'
    | 'publisher'
    | 'price'
    | 'shelf'
    | 'tags'
    | 'authors'
    | 'read'
    | 'titles';

export interface BatchDraft {
    fields: BatchField[];
    category: BookCategory | 'keep';
    ownership: BookOwnership | 'keep';
    publisher: TextChoice;
    price: TextChoice;
    shelf: { mode: ChoiceMode; bookcaseId: string | null; shelfId: string | null };
    addTags: DraftTag[];
    removeTags: DraftTag[];
    replaceAuthors: boolean;
    authors: DraftAuthor[];
    read: 'keep' | 'read' | 'not-read';
    generatedTitles: boolean;
}

export type BatchProblem =
    | 'nothing'
    | 'category'
    | 'ownership'
    | 'publisher'
    | 'price'
    | 'shelf'
    | 'authors'
    | 'read';

export type Shown = { text: string } | { key: MessageKey };

export type ChangeLine = { label: MessageKey; before: Shown; after: Shown };

export interface ChangedBook {
    id: string;
    title: string;
    before: Shown;
    after: Shown;
}

export interface ChangeGroup {
    label: MessageKey;
    after: Shown | null;
    books: ChangedBook[];
    others: number;
}

export type BookOutcome = { changes: number } | 'left-out';

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
const batchFieldLabels: Record<BatchField, MessageKey> = {
    category: 'form.category',
    ownership: 'form.ownership',
    publisher: 'form.publisher',
    price: 'batch.price',
    shelf: 'batch.location',
    tags: 'tags.field',
    authors: 'form.authors',
    read: 'form.reading',
    titles: 'batch.titles',
};
const fieldOrder = Object.keys(batchFieldLabels) as BatchField[];
const fillableLabels: Partial<Record<MessageKey, 'publisher' | 'price' | 'shelf'>> = {
    'form.publisher': 'publisher',
    'batch.price': 'price',
    'batch.location': 'shelf',
};
const skipReasons: Record<BookBatchSkipReason, MessageKey> = {
    'book-lent': 'batch.skip.lent',
    'possible-duplicate': 'batch.skip.duplicate',
    'title-not-generated': 'batch.skip.books',
};

export class CollectionBatch {
    static draft(): BatchDraft {
        return {
            fields: [],
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

    static fieldLabel(field: BatchField): MessageKey {
        return batchFieldLabels[field];
    }

    static remaining(draft: BatchDraft): BatchField[] {
        return fieldOrder.filter((field) => !draft.fields.includes(field));
    }

    static add(draft: BatchDraft, field: BatchField): BatchDraft {
        if (draft.fields.includes(field)) {
            return draft;
        }

        const added = { ...draft, fields: [...draft.fields, field] };

        switch (field) {
            case 'publisher':
            case 'price':
                return { ...added, [field]: { ...draft[field], mode: 'set' } };
            case 'shelf':
                return { ...added, shelf: { ...draft.shelf, mode: 'set' } };
            case 'authors':
                return { ...added, replaceAuthors: true };
            case 'titles':
                return { ...added, generatedTitles: true };
            default:
                return added;
        }
    }

    static remove(draft: BatchDraft, field: BatchField): BatchDraft {
        const initial = CollectionBatch.draft();
        const removed = { ...draft, fields: draft.fields.filter((added) => added !== field) };

        switch (field) {
            case 'tags':
                return { ...removed, addTags: [], removeTags: [] };
            case 'authors':
                return { ...removed, replaceAuthors: false, authors: [] };
            case 'titles':
                return { ...removed, generatedTitles: false };
            default:
                return { ...removed, [field]: initial[field] };
        }
    }

    static owned(collection: CollectionDetailsDto): string[] {
        return CollectionCovers.books(collection)
            .filter((book) => book.ownership === 'owned')
            .map((book) => book.id);
    }

    static problem(draft: BatchDraft): BatchProblem | null {
        for (const field of ['category', 'ownership', 'read'] as const) {
            if (draft.fields.includes(field) && draft[field] === 'keep') {
                return field;
            }
        }

        if (CollectionBatch.takesValue(draft.publisher.mode) && !draft.publisher.value.trim()) {
            return 'publisher';
        }

        if (CollectionBatch.takesValue(draft.price.mode) && !draft.price.value.trim()) {
            return 'price';
        }

        if (CollectionBatch.takesValue(draft.shelf.mode) && !draft.shelf.shelfId) {
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

        const filled = CollectionBatch.filled(draft);

        if (filled.length > 0) {
            changes.onlyIfEmpty = filled;
        }

        return changes;
    }

    static takesValue(mode: ChoiceMode): boolean {
        return mode === 'set' || mode === 'fill';
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
                    label: Required.value(fieldLabels[field], 'every listed field has a label'),
                    before: CollectionBatch.value(field, before, locale),
                    after: CollectionBatch.value(field, after, locale),
                });
            }
        }

        return lines;
    }

    static byChange(summary: BookBatchDto, locale: string): ChangeGroup[] {
        const groups = new Map<MessageKey, ChangedBook[]>();

        for (const book of summary.books) {
            for (const line of CollectionBatch.lines(book.before, book.after, locale)) {
                const changed = { id: book.id, title: book.title, ...line };

                groups.set(line.label, [...(groups.get(line.label) ?? []), changed]);
            }
        }

        return [...groups].map(([label, books]) => ({
            label,
            after: CollectionBatch.common(books.map((book) => book.after)),
            books: books.map(({ id, title, before, after }) => ({ id, title, before, after })),
            others: summary.books.length - books.length,
        }));
    }

    static outcomes(summary: BookBatchDto, locale: string): Map<string, BookOutcome> {
        const outcomes = new Map<string, BookOutcome>();

        for (const book of summary.books) {
            outcomes.set(book.id, {
                changes: CollectionBatch.lines(book.before, book.after, locale).length,
            });
        }

        for (const skip of summary.skipped) {
            outcomes.set(skip.id, 'left-out');
        }

        return outcomes;
    }

    static changed(summary: BookBatchDto): number {
        return summary.books.filter((book) => Object.keys(book.after).length > 0).length;
    }

    static only(summary: BookBatchDto, bookId: string): BookBatchDto {
        return {
            ...summary,
            books: summary.books.filter((book) => book.id === bookId),
            skipped: summary.skipped.filter((skip) => skip.id === bookId),
        };
    }

    static fillsOnly(draft: BatchDraft, label: MessageKey): boolean {
        const field = fillableLabels[label];

        return field !== undefined && draft[field].mode === 'fill';
    }

    static skipReason(reason: BookBatchSkipReason): MessageKey {
        return skipReasons[reason];
    }

    private static value(field: Field, fields: BookBatchFieldsDto, locale: string): Shown {
        switch (field) {
            case 'category':
                return {
                    key: BookFormat.category(
                        Required.value(fields.category, 'a changed category has a value'),
                    ),
                };
            case 'ownership':
                return {
                    key: BookFormat.ownership(
                        Required.value(fields.ownership, 'a changed ownership has a value'),
                    ),
                };
            case 'read':
                return {
                    key: BookFormat.reading(
                        Required.value(fields.read, 'a changed reading state has a value'),
                    ),
                };
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

    private static common(values: Shown[]): Shown | null {
        const first = values[0] ?? null;

        return values.every((value) => JSON.stringify(value) === JSON.stringify(first))
            ? first
            : null;
    }

    private static filled(draft: BatchDraft): BookBatchFillable[] {
        const modes: [BookBatchFillable, ChoiceMode][] = [
            ['publisher', draft.publisher.mode],
            ['price', draft.price.mode],
            ['shelfId', draft.shelf.mode],
        ];

        return modes.filter(([, mode]) => mode === 'fill').map(([field]) => field);
    }

    private static text(choice: TextChoice): string | null {
        return choice.mode === 'clear' ? null : choice.value.trim();
    }
}
