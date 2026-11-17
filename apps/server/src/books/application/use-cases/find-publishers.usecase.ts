import type { FindPublishersUseCase } from '../ports/driving/find-publishers-use-case.interface.js';
import type { PublisherMatcher } from '../services/publisher-matcher.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FindPublishers implements FindPublishersUseCase {
    private static readonly limit = 10;

    constructor(private readonly publishers: PublisherMatcher) {}

    async execute(actor: Actor, search: string): Promise<string[]> {
        ActorAuthorization.requireReady(actor);

        return (await this.publishers.names()).search(search, FindPublishers.limit);
    }
}
