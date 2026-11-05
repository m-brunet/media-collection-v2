import type {
    AuthorChoiceDto,
    BookCategory,
    BookDto,
    BookInputDto,
    BookOwnership,
    MembershipDto,
} from '../../../../../packages/contracts/src/http';
import { BookFormat } from './book-format.util';

// One author in the form: an existing identity (`id`) or a name to reuse or create.
export interface DraftAuthor {
    id: string | null;
    name: string;
    // Confirmed as different from a similar existing author.
    distinct: boolean;
}

// One tag in the form: an existing tag (`id`) or a name the server reuses or creates.
export interface DraftTag {
    id: string | null;
    name: string;
}

// Everything the book form edits, as typed.
export interface BookDraftValues {
    isbn: string;
    noIsbn: boolean;
    title: string;
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
    // The viewer's own note; null when they have none.
    note: string | null;
    // Collection membership: a collection name (joined or created by the server) and the covered
    // volumes, one number or a consecutive omnibus range.
    inCollection: boolean;
    collectionName: string;
    // Confirmed as a different collection from a similar existing one.
    collectionDistinct: boolean;
    omnibus: boolean;
    volumeFrom: string;
    volumeTo: string;
    // The person accepted to include volume 0 in the collection.
    enableVolumeZero: boolean;
    // Physical location: a shelf of the chosen bookcase; a bookcase alone is not a location.
    bookcaseId: string | null;
    shelfId: string | null;
    tags: DraftTag[];
}

// Why the collection part of the form cannot be sent yet.
export type CollectionProblem = 'collection-name-required' | 'volume-required';

// Why the location part of the form cannot be sent yet.
export type LocationProblem = 'shelf-required';

export interface SaveOptions {
    // A new no-ISBN book is distinct from the similar saved ones.
    confirmDistinct?: boolean;
    // Planned Not Owned books this Owned book replaces, deleted by the server.
    replacePlanned?: string[];
}

export class BookDraft {
    static empty(): BookDraftValues {
        return {
            isbn: '',
            noIsbn: false,
            title: '',
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

    // A new book started from a collection page belongs to that collection.
    static inCollection(name: string): BookDraftValues {
        return { ...BookDraft.empty(), inCollection: true, collectionName: name };
    }

    static fromBook(book: BookDto, locale: string): BookDraftValues {
        return {
            isbn: book.isbn ?? '',
            noIsbn: book.noIsbn,
            title: book.title,
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

    // Shared information sent to the server; blank optional fields mean "unknown".
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

    // The note to save: null removes it (an emptied note counts as removed).
    static note(values: BookDraftValues): string | null {
        return values.note?.trim() ? values.note.trim() : null;
    }

    static same(a: BookDraftValues, b: BookDraftValues): boolean {
        return JSON.stringify(BookDraft.comparable(a)) === JSON.stringify(BookDraft.comparable(b));
    }

    // Same comparison as the server: case, accents and outer spaces do not matter.
    static nameKey(value: string): string {
        return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
    }

    // Applies the person's answer to a similar-author question to the matching typed name.
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

    // Answers given in dialogs are not changes of their own.
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
