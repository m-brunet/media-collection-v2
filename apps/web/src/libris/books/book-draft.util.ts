import type {
    AuthorChoiceDto,
    BookCategory,
    BookDto,
    BookInputDto,
    BookOwnership,
} from '../../../../../packages/contracts/src/http';
import { BookFormat } from './book-format.util';

// One author in the form: an existing identity (`id`) or a name to reuse or create.
export interface DraftAuthor {
    id: string | null;
    name: string;
    // Confirmed as different from a similar existing author.
    distinct: boolean;
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
        };
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
        };
    }

    // Shared information sent to the server; blank optional fields mean "unknown".
    static toInput(values: BookDraftValues, confirmDistinct = false): BookInputDto {
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
            ...(confirmDistinct ? { confirmDistinct: true } : {}),
        };
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

    private static comparable(values: BookDraftValues) {
        return { ...values, note: BookDraft.note(values) };
    }

    private static optional(value: string): string | null {
        return value.trim() === '' ? null : value.trim();
    }

    private static number(value: string): number | null {
        return value.trim() === '' ? null : Number(value);
    }
}
