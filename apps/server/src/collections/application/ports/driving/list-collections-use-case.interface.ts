import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CollectionListPage, CollectionListQuery } from '../../collection-views.js';

export interface ListCollectionsUseCase {
    // Collections by name; with a search or filters, those with at least one book matching them
    // all. The actor's own reading status may be filtered on, except by Guests.
    execute(actor: Actor, query: CollectionListQuery): Promise<CollectionListPage>;
}
