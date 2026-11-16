import type { Actor } from '../../../../shared/domain/actor.helper.js';

export type VolumeCover = { kind: 'found'; token: string } | { kind: 'none' };

export interface FindVolumeCoverUseCase {
    execute(actor: Actor, isbn: string): Promise<VolumeCover>;
}
