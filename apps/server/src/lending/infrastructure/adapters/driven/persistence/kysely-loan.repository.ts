import type { LoanRepository } from '../../../../application/ports/driven/loan-repository.interface.js';
import { Loan, type LoanStatus } from '../../../../domain/entities/loan.entity.js';
import { Failure } from '../../../../../shared/domain/exceptions/failure.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type LoanRow = DatabaseSchema['loans'];

export class KyselyLoanRepository implements LoanRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findByIds(ids: readonly string[]): Promise<Loan[]> {
        if (ids.length === 0) {
            return [];
        }

        const rows = await this.db
            .selectFrom('loans')
            .selectAll()
            .where('id', 'in', [...ids])
            .execute();
        const byId = new Map(rows.map((row) => [row.id, row]));

        return ids.flatMap((id) => {
            const row = byId.get(id);

            return row ? [this.map(row)] : [];
        });
    }

    async findActiveByBooks(bookIds: readonly string[]): Promise<Loan[]> {
        if (bookIds.length === 0) {
            return [];
        }

        const rows = await this.db
            .selectFrom('loans')
            .selectAll()
            .where('status', '=', 'lent')
            .where('book_id', 'in', [...bookIds])
            .execute();

        return rows.map((row) => this.map(row));
    }

    async create(loan: Loan): Promise<void> {
        const row = this.row(loan);

        try {
            await this.db.insertInto('loans').values(row).execute();
        } catch (error) {
            this.rethrow(error, row.book_id);
        }
    }

    async save(loan: Loan): Promise<void> {
        const state = loan.snapshot;

        await this.db
            .updateTable('loans')
            .set({ status: state.status, returned_at: state.returnedAt })
            .where('id', '=', state.id)
            .execute();
    }

    async keepIdentification(book: {
        id: string;
        title: string;
        isbn: string | null;
    }): Promise<void> {
        await this.db
            .updateTable('loans')
            .set({ book_title: book.title, book_isbn: book.isbn })
            .where('book_id', '=', book.id)
            .execute();
    }

    private map(row: LoanRow): Loan {
        return Loan.restore({
            id: row.id,
            bookId: row.book_id,
            receiverId: row.receiver_id,
            status: row.status as LoanStatus,
            lentAt: row.lent_at,
            returnedAt: row.returned_at,
            bookTitle: row.book_title,
            bookIsbn: row.book_isbn,
        });
    }

    private row(loan: Loan): LoanRow {
        const state = loan.snapshot;

        return {
            id: state.id,
            book_id: state.bookId,
            receiver_id: state.receiverId,
            status: state.status,
            lent_at: state.lentAt,
            returned_at: state.returnedAt,
            book_title: state.bookTitle,
            book_isbn: state.bookIsbn,
        };
    }

    // The partial unique index refuses a second active loan of a book.
    private rethrow(error: unknown, bookId: string | null): never {
        if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'SQLITE_CONSTRAINT_UNIQUE' &&
            error.message.includes('loans.book_id')
        ) {
            throw new Failure('conflict', 'A selected book is already lent.', 'book-already-lent', {
                bookIds: [bookId],
            });
        }

        throw error;
    }
}
