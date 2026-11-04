import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CoverMediaType } from '../../../domain/value-objects/cover-image.value-object.js';

export interface ReadCoverUseCase {
    execute(
        actor: Actor,
        bookId: string,
    ): Promise<{ bytes: Uint8Array; mediaType: CoverMediaType }>;
}
