import { AsyncLocalStorage } from 'node:async_hooks';
import type { Kysely, Transaction } from 'kysely';
import type { TransactionRunner } from '../../../../application/ports/driven/transaction-runner.interface.js';
import type { DatabaseSchema } from './database.adapter.js';

// Gives repositories the connection to use: the open transaction of the current operation when
// there is one, otherwise the database itself. Repositories must always ask for `current`.
export class DatabaseConnections implements TransactionRunner {
    private readonly scope = new AsyncLocalStorage<Transaction<DatabaseSchema>>();

    constructor(private readonly root: Kysely<DatabaseSchema>) {}

    get current(): Kysely<DatabaseSchema> {
        return this.scope.getStore() ?? this.root;
    }

    run<T>(work: () => Promise<T>): Promise<T> {
        if (this.scope.getStore()) {
            return work();
        }

        return this.root.transaction().execute((transaction) => this.scope.run(transaction, work));
    }
}
