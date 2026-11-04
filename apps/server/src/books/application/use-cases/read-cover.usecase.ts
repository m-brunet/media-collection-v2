import type { ReadCoverUseCase } from '../ports/driving/read-cover-use-case.interface.js';
import type { CoverStorage } from '../ports/driven/cover-storage.interface.js';
import { BookLoader } from '../services/book-loader.service.js';
import type { CoverMediaType } from '../../domain/value-objects/cover-image.value-object.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class ReadCover implements ReadCoverUseCase {
    constructor(
        private readonly covers: CoverStorage,
        private readonly loader: BookLoader,
    ) {}

    async execute(
        actor: Actor,
        bookId: string,
    ): Promise<{ bytes: Uint8Array; mediaType: CoverMediaType }> {
        ActorAuthorization.requireReady(actor);
        const file = (await this.loader.load(bookId)).snapshot.coverFile;
        const cover = file ? await this.covers.read(file) : null;

        if (!cover) {
            throw new Failure('not_found', 'This book has no cover.', 'cover-missing');
        }

        return cover;
    }
}
