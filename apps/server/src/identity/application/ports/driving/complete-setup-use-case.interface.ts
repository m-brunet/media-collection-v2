import type { Actor } from '../../../../shared/domain/actor.helper.js';

export interface CompleteSetupUseCase {
    // Creates the protected administrator on first launch and signs it in.
    execute(input: {
        username: string;
        password: string;
    }): Promise<{ actor: Actor; token: string }>;
}
