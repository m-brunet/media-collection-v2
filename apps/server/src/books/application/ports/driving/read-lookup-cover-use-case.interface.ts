import type { Actor } from '../../../../shared/domain/actor.helper.js';
import type { CoverImage } from '../../../domain/value-objects/cover-image.value-object.js';

export interface ReadLookupCoverUseCase {
    execute(actor: Actor, token: string): Promise<CoverImage>;
}
