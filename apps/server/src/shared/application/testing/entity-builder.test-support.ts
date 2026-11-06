// Builds one valid domain entity for a test, with readable defaults: `with…` methods set one value,
// `as…` methods set several at once to reach a coherent state. `build()` only creates the entity;
// `buildAndSave(ports)` also stores it through the application's repository ports (in-memory
// doubles in unit tests, SQLite adapters in API and persistence tests), creating missing parents
// first. Builders arrange preconditions only: a test about a business rule goes through the use
// case or the endpoint.
export abstract class EntityBuilder<TEntity, TPorts> {
    abstract build(): TEntity;

    abstract buildAndSave(ports: TPorts): Promise<TEntity>;
}

// A builder was asked to save an entity whose parent it cannot create itself.
export class BuilderError extends Error {
    constructor(builder: string, missing: string, hint: string) {
        super(builder + ' cannot save without ' + missing + ': ' + hint);
    }
}
