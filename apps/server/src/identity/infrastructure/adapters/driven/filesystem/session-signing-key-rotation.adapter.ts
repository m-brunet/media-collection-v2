import type { SessionKeyRotation } from '../../../../../maintenance/application/ports/driven/session-key-rotation.interface.js';
import type { SessionSigningKey } from './session-signing-key.adapter.js';

export class SessionSigningKeyRotation implements SessionKeyRotation {
    constructor(
        private readonly key: SessionSigningKey,
        private readonly directory: string,
    ) {}

    async rotate(): Promise<void> {
        this.key.rotate(this.directory);
    }
}
