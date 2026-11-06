import type { LendableBooks } from '../../../../application/ports/driven/lendable-books.interface.js';
import type { LendableBook } from '../../../../domain/entities/loan.entity.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// Reads the books table, and active loans with their receiver, for the books chosen in a lending
// operation.
export class KyselyLendableBooks implements LendableBooks {
    constructor(private readonly connections: DatabaseConnections) {}

    async find(ids: readonly string[]): Promise<LendableBook[]> {
        if (ids.length === 0) {
            return [];
        }

        const rows = await this.connections.current
            .selectFrom('books')
            .leftJoin('loans', (join) =>
                join.onRef('loans.book_id', '=', 'books.id').on('loans.status', '=', 'lent'),
            )
            .leftJoin('receivers', 'receivers.id', 'loans.receiver_id')
            .select([
                'books.id',
                'books.title',
                'books.isbn13',
                'books.ownership',
                'receivers.name as receiver_name',
            ])
            .where('books.id', 'in', [...ids])
            .execute();
        const byId = new Map(rows.map((row) => [row.id, row]));

        return ids.flatMap((id) => {
            const row = byId.get(id);

            return row
                ? [
                      {
                          id: row.id,
                          title: row.title,
                          isbn: row.isbn13,
                          ownership: row.ownership === 'owned' ? 'owned' : 'not-owned',
                          lentTo: row.receiver_name,
                      } satisfies LendableBook,
                  ]
                : [];
        });
    }
}
