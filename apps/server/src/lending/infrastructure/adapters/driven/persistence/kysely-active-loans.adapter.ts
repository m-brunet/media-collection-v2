import type { ActiveLoans } from '../../../../application/ports/driven/active-loans.interface.js';
import type { ActiveLoansQuery, ReceiverLoansView } from '../../../../application/loan-views.js';
import { NameKey } from '../../../../../shared/domain/name-key.helper.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

// The active-loans page: books currently lent with their receiver. Search covers the receiver
// name and the book title only, never authors or ISBN.
export class KyselyActiveLoans implements ActiveLoans {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async list(query: ActiveLoansQuery): Promise<ReceiverLoansView[]> {
        const key = NameKey.of(query.search ?? '');
        let rows = this.db
            .selectFrom('loans')
            .innerJoin('receivers', 'receivers.id', 'loans.receiver_id')
            .innerJoin('books', 'books.id', 'loans.book_id')
            .select([
                'loans.id as loan_id',
                'loans.lent_at',
                'receivers.id as receiver_id',
                'receivers.name as receiver_name',
                'books.id as book_id',
                'books.title',
                'books.publisher',
                'books.publication_year',
                'books.isbn13',
                'books.cover_file',
            ])
            .where('loans.status', '=', 'lent');

        if (query.receiverId) {
            rows = rows.where('loans.receiver_id', '=', query.receiverId);
        }

        if (key.length > 0) {
            rows = rows.where((eb) =>
                eb.or([
                    eb(eb.fn<number>('instr', [eb.ref('receivers.name_key'), eb.val(key)]), '>', 0),
                    eb(eb.fn<number>('instr', [eb.ref('books.title_key'), eb.val(key)]), '>', 0),
                ]),
            );
        }

        const loans = await rows
            .orderBy('receivers.name_key')
            .orderBy('receivers.id')
            .orderBy('loans.lent_at', 'desc')
            .orderBy('books.title_key')
            .execute();
        const authors = await this.authorsOf(loans.map((loan) => loan.book_id));
        const groups: ReceiverLoansView[] = [];

        for (const loan of loans) {
            let group = groups.at(-1);

            if (group?.receiver.id !== loan.receiver_id) {
                group = { receiver: { id: loan.receiver_id, name: loan.receiver_name }, loans: [] };
                groups.push(group);
            }

            group.loans.push({
                loanId: loan.loan_id,
                lentAt: loan.lent_at,
                book: {
                    id: loan.book_id,
                    title: loan.title,
                    authors: authors.get(loan.book_id) ?? [],
                    publisher: loan.publisher,
                    publicationYear: loan.publication_year,
                    isbn: loan.isbn13,
                    hasCover: loan.cover_file !== null,
                },
            });
        }

        return groups;
    }

    private async authorsOf(bookIds: string[]): Promise<Map<string, string[]>> {
        const authors = new Map<string, string[]>();

        if (bookIds.length === 0) {
            return authors;
        }

        const rows = await this.db
            .selectFrom('book_authors')
            .innerJoin('authors', 'authors.id', 'book_authors.author_id')
            .select(['book_authors.book_id', 'authors.name'])
            .where('book_authors.book_id', 'in', bookIds)
            .orderBy('book_authors.book_id')
            .orderBy('book_authors.position')
            .execute();

        for (const row of rows) {
            authors.set(row.book_id, [...(authors.get(row.book_id) ?? []), row.name]);
        }

        return authors;
    }
}
