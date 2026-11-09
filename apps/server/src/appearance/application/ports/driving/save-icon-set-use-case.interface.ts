import type { IconSetName } from '../../../domain/value-objects/icon-set.value-object.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SaveIconSetUseCase {
    // Administrator only; applies to every account and device.
    execute(actor: Actor, iconSet: string): Promise<{ iconSet: IconSetName }>;
}
