import type { Actor } from '../../../../shared/domain/actor.helper.js';

export type VolumeCover =
    | { kind: 'found'; token: string }
    | { kind: 'none' }
    | { kind: 'limited'; retryAt: string };

export interface FindVolumeCoverUseCase {
    execute(actor: Actor, isbn: string): Promise<VolumeCover>;
}
