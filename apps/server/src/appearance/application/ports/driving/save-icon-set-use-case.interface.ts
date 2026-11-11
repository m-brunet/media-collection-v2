import type { IconSetName } from '../../../domain/value-objects/icon-set.value-object.js';
import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface SaveIconSetUseCase {
    execute(actor: Actor, iconSet: string): Promise<{ iconSet: IconSetName }>;
}
