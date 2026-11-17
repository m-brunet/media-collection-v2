import type { PublisherCatalog } from '../../../../application/ports/driven/publisher-catalog.interface.js';
import type { PublisherUsage } from '../../../../domain/value-objects/publisher-names.value-object.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

export class KyselyPublisherCatalog implements PublisherCatalog {
    constructor(private readonly connections: DatabaseConnections) {}

    async usages(): Promise<PublisherUsage[]> {
        const rows = await this.connections.current
            .selectFrom('books')
            .where('books.publisher', 'is not', null)
            .select((eb) => ['books.publisher', eb.fn.countAll<number>().as('books')])
            .groupBy('books.publisher')
            .execute();

        return rows.map((row) => ({ name: row.publisher ?? '', books: Number(row.books) }));
    }
}
