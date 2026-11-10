import type { Actor } from '../../domain/actor.helper.js';

// The username is the identifier.
export class TestActors {
    static of(role: Actor['role'], id: string, mustChangePassword = false): Actor {
        return { id, username: id, role, mustChangePassword, language: null };
    }
}
