import type { GetBookUseCase } from '../ports/driving/get-book-use-case.interface.js';
import type { BookView } from '../book-views.js';
import { BookLoader } from '../services/book-loader.service.js';
import { BookViewer } from '../services/book-viewer.service.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class GetBook implements GetBookUseCase {
    constructor(
        private readonly loader: BookLoader,
        private readonly viewer: BookViewer,
    ) {}

    async execute(actor: Actor, bookId: string): Promise<BookView> {
        ActorAuthorization.requireReady(actor);

        return this.viewer.view(await this.loader.load(bookId), actor);
    }
}
