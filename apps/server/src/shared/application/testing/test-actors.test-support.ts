import type { Actor } from '../../domain/actor.helper.js';

// Signed-in accounts as use cases receive them; the username is the identifier.
export class TestActors {
    static of(role: Actor['role'], id: string, mustChangePassword = false): Actor {
        return { id, username: id, role, mustChangePassword, language: null };
    }
}
