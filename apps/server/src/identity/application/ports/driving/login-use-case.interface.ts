import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface LoginUseCase {
    execute(username: string, password: string): Promise<{ actor: Actor; token: string }>;
}
