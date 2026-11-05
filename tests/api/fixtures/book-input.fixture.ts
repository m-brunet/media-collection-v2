import type { NewBookDto } from '../../../packages/contracts/src/http.js';

// A complete new-book request body; tests override only what they exercise.
export class BookInputFixture {
    static of(overrides: Partial<NewBookDto> = {}): NewBookDto {
        return {
            title: 'Piranesi',
            isbn: '9781635575637',
            noIsbn: false,
            authors: [{ name: 'Susanna Clarke' }],
            category: 'books',
            ownership: 'owned',
            publisher: 'Bloomsbury',
            publicationYear: 2020,
            publicationMonth: 9,
            summary: null,
            pageCount: 272,
            price: '16.90',
            read: false,
            collection: null,
            shelfId: null,
            tags: [],
            ...overrides,
        };
    }
}
