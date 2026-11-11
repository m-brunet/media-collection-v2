export abstract class EntityBuilder<TEntity, TPorts> {
    abstract build(): TEntity;

    abstract buildAndSave(ports: TPorts): Promise<TEntity>;
}

export class BuilderError extends Error {
    constructor(builder: string, missing: string, hint: string) {
        super(builder + ' cannot save without ' + missing + ': ' + hint);
    }
}
