import { expect, it } from 'vitest';
import {
    MemoryAuthors,
    MemoryBooks,
} from '../../../apps/server/src/books/application/testing/book-doubles.test-support.js';
import { BookBuilder } from '../../../apps/server/src/books/application/testing/book-builder.test-support.js';
import {
    MemoryLoanStore,
    MemoryReceivers,
} from '../../../apps/server/src/lending/application/testing/lending-doubles.test-support.js';
import { LoanBuilder } from '../../../apps/server/src/lending/application/testing/loan-builder.test-support.js';
import { ReceiverBuilder } from '../../../apps/server/src/lending/application/testing/receiver-builder.test-support.js';
import { TestLibrary } from './test-library.js';

// A library backed by the memory doubles of the books and lending features.
function memoryLibrary() {
    const books = new MemoryBooks();
    const ports = {
        books,
        authors: new MemoryAuthors(books),
        loans: new MemoryLoanStore(),
        receivers: new MemoryReceivers(),
    };

    return { ports, library: new TestLibrary(ports) };
}

it('saves a book', async () => {
    const { ports, library } = memoryLibrary();

    const result = await library.book(new BookBuilder().withTitle('Piranesi'));

    expect(ports.books.books.get(result.id)?.details.title).toBe('Piranesi');
});

it('saves a receiver', async () => {
    const { ports, library } = memoryLibrary();

    const result = await library.receiver(new ReceiverBuilder().withName('Sam Taylor'));

    expect((await ports.receivers.findById(result.id))?.snapshot.name).toBe('Sam Taylor');
});

it('creates the book and the receiver of a loan given neither', async () => {
    const { ports, library } = memoryLibrary();

    const result = await library.loan();

    expect(ports.books.books.has(result.snapshot.bookId!)).toBe(true);
    expect(await ports.receivers.findById(result.snapshot.receiverId)).not.toBeNull();
});

it('lends the given book, recording its title and ISBN', async () => {
    const { library } = memoryLibrary();
    const piranesi = await library.book(
        new BookBuilder().withTitle('Piranesi').withIsbn('9781635575637'),
    );

    const result = await library.loan(new LoanBuilder().asReturned(), piranesi);

    expect(result.snapshot).toMatchObject({
        bookId: piranesi.id,
        bookTitle: 'Piranesi',
        bookIsbn: '9781635575637',
        status: 'returned',
    });
});
