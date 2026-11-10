import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CompleteSetupUseCase {
    execute(input: {
        username: string;
        password: string;
    }): Promise<{ actor: Actor; token: string }>;
}
