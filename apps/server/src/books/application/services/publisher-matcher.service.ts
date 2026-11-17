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

        const names = await this.others(own);

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

    private async others(own: string | null): Promise<PublisherNames> {
        const usages = await this.catalog.usages();
        const edited = own?.trim();
        const index = usages.findIndex((usage) => usage.name.trim() === edited);

        return PublisherNames.of(
            usages.map((usage, position) =>
                position === index ? { ...usage, books: usage.books - 1 } : usage,
            ),
        );
    }
}
