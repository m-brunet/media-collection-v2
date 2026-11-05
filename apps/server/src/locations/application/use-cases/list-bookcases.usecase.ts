import type { ListBookcasesUseCase } from '../ports/driving/list-bookcases-use-case.interface.js';
import type { BookcaseView } from '../location-views.js';
import { LocationOverview } from '../services/location-overview.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ListBookcases implements ListBookcasesUseCase {
    constructor(private readonly overview: LocationOverview) {}

    async execute(actor: Actor): Promise<BookcaseView[]> {
        ActorAuthorization.requireReady(actor);

        return this.overview.all();
    }
}
