import type { FetchCoverFromAddressUseCase } from '../ports/driving/fetch-cover-from-address-use-case.interface.js';
import type { CoverDownloader } from '../ports/driven/cover-downloader.interface.js';
import { CoverImage } from '../../domain/value-objects/cover-image.value-object.js';
import { Failure } from '../../../shared/domain/exceptions/failure.js';
import type { Actor } from '../../../shared/domain/actor.helper.js';
import { ActorAuthorization } from '../../../shared/domain/actor.helper.js';

export class FetchCoverFromAddress implements FetchCoverFromAddressUseCase {
    static readonly maximumLength = 2000;

    constructor(private readonly downloader: CoverDownloader) {}

    async execute(actor: Actor, address: string): Promise<CoverImage> {
        ActorAuthorization.requireLibraryEditor(actor);
        Failure.ensure(
            FetchCoverFromAddress.webAddress(address),
            'Enter a web address starting with http:// or https://.',
            'cover-address-invalid',
        );

        const bytes = await this.downloader.download(address.trim());

        if (!bytes) {
            throw new Failure(
                'not_found',
                'No usable image was found at this address.',
                'cover-address-unavailable',
            );
        }

        return CoverImage.from(bytes);
    }

    private static webAddress(address: string): boolean {
        const trimmed = address.trim();

        return (
            trimmed.length <= FetchCoverFromAddress.maximumLength &&
            /^https?:\/\/[^\s/]+/i.test(trimmed)
        );
    }
}
