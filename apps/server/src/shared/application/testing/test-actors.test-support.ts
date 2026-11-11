import type { Actor } from '../../domain/actor.helper.js';

export class TestActors {
    static of(role: Actor['role'], id: string, mustChangePassword = false): Actor {
        return { id, username: id, role, mustChangePassword, language: null };
    }
}
