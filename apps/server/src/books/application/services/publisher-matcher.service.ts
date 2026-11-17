import type { PublisherCatalog } from '../ports/driven/publisher-catalog.interface.js';
import { PublisherNames } from '../../domain/value-objects/publisher-names.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class PublisherMatcher {
    constructor(private readonly catalog: PublisherCatalog) {}

    async names(): Promise<PublisherNames> {
        return PublisherNames.of(await this.catalog.usages());
    }

    async resolve(
        publisher: string | null,
        distinct: boolean,
        own: string | null = null,
    ): Promise<string | null> {
        const name = publisher?.trim();

        if (!name) {
            return null;
        }

        if (distinct || name === own?.trim()) {
            return name;
        }

        const names = PublisherNames.besides(await this.catalog.usages(), own);

        if (names.has(name)) {
            return name;
        }

        const candidates = names.close(name);

        if (candidates.length > 0) {
            throw new Failure(
                'conflict',
                'A similar publisher already exists.',
                'publisher-similar',
                { name, candidates },
            );
        }

        return name;
    }
}
