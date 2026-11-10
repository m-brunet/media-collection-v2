import type { ReadLookupCoverUseCase } from '../ports/driving/read-lookup-cover-use-case.interface.js';
import type { CoverDownloader } from '../ports/driven/cover-downloader.interface.js';
import type { LookupCoverRegistry } from '../ports/driven/lookup-cover-registry.interface.js';
import { CoverImage } from '../../domain/value-objects/cover-image.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class ReadLookupCover implements ReadLookupCoverUseCase {
    constructor(
        private readonly registry: LookupCoverRegistry,
        private readonly downloader: CoverDownloader,
    ) {}

    async execute(actor: Actor, token: string): Promise<CoverImage> {
        ActorAuthorization.requireLibraryEditor(actor);
        const address = this.registry.address(token);

        if (!address) {
            throw new Failure(
                'not_found',
                'This cover is no longer available. Find the book again.',
                'lookup-cover-missing',
            );
        }

        const bytes = await this.downloader.download(address);

        try {
            if (bytes) {
                return CoverImage.from(bytes);
            }
        } catch (error) {
            // Justified: an unusable picture from a source is reported like a missing one below.
            if (!(error instanceof Failure)) {
                throw error;
            }
        }

        throw new Failure(
            'not_found',
            'The source of this cover did not provide a usable image.',
            'lookup-cover-unavailable',
        );
    }
}
