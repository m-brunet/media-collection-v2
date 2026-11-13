import type {
    AuthorChoiceDto,
    BookCategory,
    BookDto,
    BookInputDto,
    BookOwnership,
    MembershipDto,
} from '../../../../../packages/contracts/src/http';
import { BookFormat } from './book-format.util';

export interface DraftAuthor {
    id: string | null;
    name: string;
    distinct: boolean;
}

export interface DraftTag {
    id: string | null;
    name: string;
}

export interface BookDraftValues {
    isbn: string;
    noIsbn: boolean;
    title: string;
    lastGeneratedTitle: string | null;
    authors: DraftAuthor[];
    category: BookCategory;
    ownership: BookOwnership;
    read: boolean;
    publisher: string;
    publicationMonth: string;
    publicationYear: string;
    summary: string;
    pageCount: string;
    price: string;
    note: string | null;
    inCollection: boolean;
    collectionName: string;
    collectionDistinct: boolean;
    omnibus: boolean;
    volumeFrom: string;
    volumeTo: string;
    enableVolumeZero: boolean;
    bookcaseId: string | null;
    shelfId: string | null;
    tags: DraftTag[];
}

export type DraftFieldSetter = <K extends keyof BookDraftValues>(
    key: K,
    value: BookDraftValues[K],
) => void;

export type CollectionProblem = 'collection-name-required' | 'volume-required';

export type LocationProblem = 'shelf-required';

export interface SaveOptions {
    confirmDistinct?: boolean;
    replacePlanned?: string[];
}

export class BookDraft {
    static empty(): BookDraftValues {
        return {
            isbn: '',
            noIsbn: false,
            title: '',
            lastGeneratedTitle: null,
            authors: [],
            category: 'books',
            ownership: 'owned',
            read: false,
            publisher: '',
            publicationMonth: '',
            publicationYear: '',
            summary: '',
            pageCount: '',
            price: '',
            note: null,
            inCollection: false,
            collectionName: '',
            collectionDistinct: false,
            omnibus: false,
            volumeFrom: '',
            volumeTo: '',
            enableVolumeZero: false,
            bookcaseId: null,
            shelfId: null,
            tags: [],
        };
    }

    static inCollection(name: string, category: string | null = null): BookDraftValues {
        const empty = BookDraft.empty();
        const known = BookFormat.categories.find((candidate) => candidate === category);

        return {
            ...empty,
            category: known ?? empty.category,
            inCollection: true,
            collectionName: name,
        };
    }

    static fromBook(book: BookDto, locale: string): BookDraftValues {
        return {
            isbn: book.isbn ?? '',
            noIsbn: book.noIsbn,
            title: book.titleGenerated ? '' : book.title,
            lastGeneratedTitle: book.titleGenerated ? book.title : null,
            authors: book.authors.map((author) => ({ ...author, distinct: false })),
            category: book.category,
            ownership: book.ownership,
            read: book.personal?.read ?? false,
            publisher: book.publisher ?? '',
            publicationMonth: book.publicationMonth === null ? '' : String(book.publicationMonth),
            publicationYear: book.publicationYear === null ? '' : String(book.publicationYear),
            summary: book.summary ?? '',
            pageCount: book.pageCount === null ? '' : String(book.pageCount),
            price: book.priceCents === null ? '' : BookFormat.priceInput(book.priceCents, locale),
            note: book.personal?.note?.text ?? null,
            inCollection: book.collection !== null,
            collectionName: book.collection?.name ?? '',
            collectionDistinct: false,
            omnibus: book.collection
                ? book.collection.volumeTo > book.collection.volumeFrom
                : false,
            volumeFrom: book.collection ? String(book.collection.volumeFrom) : '',
            volumeTo: book.collection ? String(book.collection.volumeTo) : '',
            enableVolumeZero: false,
            bookcaseId: book.location?.bookcaseId ?? null,
            shelfId: book.location?.shelfId ?? null,
            tags: book.tags.map((tag) => ({ id: tag.id, name: tag.name })),
        };
    }

    static toInput(values: BookDraftValues, options: SaveOptions = {}): BookInputDto {
        return {
            title: values.title,
            isbn: values.noIsbn ? null : BookDraft.optional(values.isbn),
            noIsbn: values.noIsbn,
            authors: values.authors.map((author): AuthorChoiceDto =>
                author.id
                    ? { id: author.id }
                    : { name: author.name, ...(author.distinct ? { distinct: true } : {}) },
            ),
            category: values.category,
            ownership: values.ownership,
            publisher: BookDraft.optional(values.publisher),
            publicationYear: BookDraft.number(values.publicationYear),
            publicationMonth: BookDraft.number(values.publicationMonth),
            summary: BookDraft.optional(values.summary),
            pageCount: BookDraft.number(values.pageCount),
            price: BookDraft.optional(values.price),
            ...(options.confirmDistinct ? { confirmDistinct: true } : {}),
            collection: BookDraft.membership(values),
            ...(options.replacePlanned?.length ? { replacePlanned: options.replacePlanned } : {}),
            shelfId: values.bookcaseId ? values.shelfId : null,
            tags: values.tags.map((tag) => (tag.id ? { id: tag.id } : { name: tag.name })),
        };
    }

    static titleOptional(values: BookDraftValues): boolean {
        return (values.category === 'manga' || values.category === 'comics') && values.inCollection;
    }

    static generatedTitle(values: BookDraftValues): string | null {
        const name = values.collectionName.trim();
        const from = BookDraft.number(values.volumeFrom);
        const to = values.omnibus ? BookDraft.number(values.volumeTo) : from;

        if (
            !BookDraft.titleOptional(values) ||
            !name ||
            from === null ||
            to === null ||
            !Number.isInteger(from) ||
            !Number.isInteger(to)
        ) {
            return null;
        }

        return name + ' Vol. ' + (to > from ? from + '–' + to : String(from));
    }

    static changed(current: BookDraftValues, changes: Partial<BookDraftValues>): BookDraftValues {
        const next = { ...current, ...changes };

        if (
            BookDraft.titleOptional(current) &&
            !BookDraft.titleOptional(next) &&
            next.title.trim() === ''
        ) {
            return {
                ...next,
                title: current.lastGeneratedTitle ?? BookDraft.generatedTitle(current) ?? '',
            };
        }

        return next;
    }

    static hasAdditional(values: BookDraftValues): boolean {
        return [values.publisher, values.publicationYear, values.summary, values.pageCount].some(
            (value) => value.trim() !== '',
        );
    }

    static collectionProblem(values: BookDraftValues): CollectionProblem | null {
        if (!values.inCollection) {
            return null;
        }

        if (!values.collectionName.trim()) {
            return 'collection-name-required';
        }

        const volumes = values.omnibus ? [values.volumeFrom, values.volumeTo] : [values.volumeFrom];

        return volumes.some((volume) => volume.trim() === '') ? 'volume-required' : null;
    }

    static locationProblem(values: BookDraftValues): LocationProblem | null {
        return values.bookcaseId && !values.shelfId ? 'shelf-required' : null;
    }

    static note(values: BookDraftValues): string | null {
        return values.note?.trim() ? values.note.trim() : null;
    }

    static same(a: BookDraftValues, b: BookDraftValues): boolean {
        return JSON.stringify(BookDraft.comparable(a)) === JSON.stringify(BookDraft.comparable(b));
    }

    static nameKey(value: string): string {
        return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
    }

    static resolveAuthor(
        values: BookDraftValues,
        typedName: string,
        choice: { id: string; name: string } | 'distinct',
    ): BookDraftValues {
        const key = BookDraft.nameKey(typedName);

        return {
            ...values,
            authors: values.authors.map((author) =>
                author.id === null && BookDraft.nameKey(author.name) === key
                    ? choice === 'distinct'
                        ? { ...author, distinct: true }
                        : { id: choice.id, name: choice.name, distinct: false }
                    : author,
            ),
        };
    }

    private static membership(values: BookDraftValues): MembershipDto | null {
        if (!values.inCollection) {
            return null;
        }

        const volumeFrom = Number(values.volumeFrom.trim());

        return {
            collection: {
                name: values.collectionName.trim(),
                ...(values.collectionDistinct ? { distinct: true } : {}),
            },
            volumeFrom,
            volumeTo: values.omnibus ? Number(values.volumeTo.trim()) : volumeFrom,
            ...(values.enableVolumeZero ? { enableVolumeZero: true } : {}),
        };
    }

    private static comparable(values: BookDraftValues) {
        return {
            ...values,
            note: BookDraft.note(values),
            collectionDistinct: false,
            enableVolumeZero: false,
            ...(values.inCollection
                ? {}
                : { collectionName: '', omnibus: false, volumeFrom: '', volumeTo: '' }),
        };
    }

    private static optional(value: string): string | null {
        return value.trim() === '' ? null : value.trim();
    }

    private static number(value: string): number | null {
        return value.trim() === '' ? null : Number(value);
    }
}
