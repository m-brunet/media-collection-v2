import type { BookDto, BookListItemDto } from '../../../../packages/contracts/src/http';

export function bookDto(overrides: Partial<BookDto> = {}): BookDto {
    return {
        id: 'b1',
        title: 'Piranesi',
        titleGenerated: false,
        isbn: '9781635575637',
        isbnConvertedFromIsbn10: false,
        noIsbn: false,
        authors: [{ id: 'a1', name: 'Susanna Clarke' }],
        category: 'books',
        ownership: 'owned',
        publisher: 'Bloomsbury',
        publicationYear: 2020,
        publicationMonth: 9,
        summary: 'A labyrinth of halls.',
        pageCount: 272,
        priceCents: 1690,
        hasCover: false,
        collection: null,
        location: null,
        tags: [],
        loan: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        personal: { read: false, note: null },
        ...overrides,
    };
}

export function bookItem(overrides: Partial<BookListItemDto> = {}): BookListItemDto {
    return {
        id: 'b1',
        title: 'Piranesi',
        authors: ['Susanna Clarke'],
        category: 'books',
        ownership: 'owned',
        hasCover: false,
        collection: null,
        updatedAt: '2026-01-01T00:00:00.000Z',
        read: false,
        loan: null,
        ...overrides,
    };
}
