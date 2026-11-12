import type { DatabaseSchema } from '../../../../../shared/infrastructure/adapters/driven/persistence/database.adapter.js';
import type { DatabaseConnections } from '../../../../../shared/infrastructure/adapters/driven/persistence/database-connections.adapter.js';
import { PairingCode } from '../../../../domain/entities/pairing-code.entity.js';
import type { PairingCodeRepository } from '../../../../application/ports/driven/pairing-code-repository.interface.js';

export class KyselyPairingCodeRepository implements PairingCodeRepository {
    constructor(private readonly connections: DatabaseConnections) {}

    private get db() {
        return this.connections.current;
    }

    async findByHash(codeHash: string): Promise<PairingCode | null> {
        const row = await this.db
            .selectFrom('pairing_codes')
            .selectAll()
            .where('code_hash', '=', codeHash)
            .executeTakeFirst();

        return row ? this.map(row) : null;
    }

    async replace(code: PairingCode): Promise<void> {
        const row = this.row(code);

        await this.db
            .deleteFrom('pairing_codes')
            .where((eb) =>
                eb.or([
                    eb('account_id', '=', row.account_id),
                    eb('expires_at', '<=', row.created_at),
                ]),
            )
            .execute();
        await this.db.insertInto('pairing_codes').values(row).execute();
    }

    async consume(code: PairingCode): Promise<boolean> {
        const { id, used_at } = this.row(code);
        const result = await this.db
            .updateTable('pairing_codes')
            .set({ used_at })
            .where('id', '=', id)
            .where('used_at', 'is', null)
            .executeTakeFirst();

        return result.numUpdatedRows === 1n;
    }

    private map(row: DatabaseSchema['pairing_codes']): PairingCode {
        return new PairingCode({
            id: row.id,
            accountId: row.account_id,
            codeHash: row.code_hash,
            tokenVersion: row.token_version,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
            usedAt: row.used_at,
        });
    }

    private row(code: PairingCode): DatabaseSchema['pairing_codes'] {
        const state = code.snapshot;

        return {
            id: state.id,
            account_id: state.accountId,
            code_hash: state.codeHash,
            token_version: state.tokenVersion,
            created_at: state.createdAt,
            expires_at: state.expiresAt,
            used_at: state.usedAt,
        };
    }
}
