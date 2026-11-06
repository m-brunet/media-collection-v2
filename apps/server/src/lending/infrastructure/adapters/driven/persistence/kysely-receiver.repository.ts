import type { ReceiverRepository } from '../../../../application/ports/driven/receiver-repository.interface.js';
import { Receiver } from '../../../../domain/entities/receiver.entity.js';
import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';

type ReceiverRow = DatabaseSchema['receivers'];

export class KyselyReceiverRepository implements ReceiverRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findById(id: string): Promise<Receiver | null> {
        const row = await this.db
            .selectFrom('receivers')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async findByKey(key: string): Promise<Receiver | null> {
        const row = await this.db
            .selectFrom('receivers')
            .selectAll()
            .where('name_key', '=', key)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async list(): Promise<Receiver[]> {
        const rows = await this.db
            .selectFrom('receivers')
            .selectAll()
            .orderBy('name_key')
            .execute();

        return rows.map((row) => this.map(row));
    }

    async create(receiver: Receiver): Promise<void> {
        const state = receiver.snapshot;

        await this.db
            .insertInto('receivers')
            .values({
                id: state.id,
                name: state.name,
                name_key: receiver.key,
                created_at: state.createdAt,
            })
            .execute();
    }

    private map(row: ReceiverRow): Receiver {
        return new Receiver({ id: row.id, name: row.name, createdAt: row.created_at });
    }
}
