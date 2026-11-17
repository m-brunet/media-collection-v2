import type { PublisherCatalog } from '../ports/driven/publisher-catalog.interface.js';
import { PublisherNames } from '../../domain/value-objects/publisher-names.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class PublisherMatcher {
    constructor(private readonly catalog: PublisherCatalog) {}

    async names(): Promise<PublisherNames> {
        return PublisherNames.of(await this.catalog.usages());
    }

    async existing(publisher: string | null): Promise<string | null> {
        const name = publisher?.trim();

        if (!name) {
            return null;
        }

        return (await this.names()).same(name) ?? name;
    }

    async resolve(publisher: string | null, distinct: boolean): Promise<string | null> {
        const name = publisher?.trim();

        if (!name) {
            return null;
        }

        const names = await this.names();
        const same = names.same(name);

        if (same) {
            return same;
        }

        const similar = distinct ? [] : names.similar(name);

        if (similar.length > 0) {
            throw new Failure(
                'conflict',
                'A similar publisher already exists.',
                'publisher-similar',
                { name, candidates: similar },
            );
        }

        return name;
    }
}
