import { Failure } from './exceptions/failure.js';

export type InterfaceLanguage = 'en' | 'fr';

export interface Actor {
    id: string;
    username: string;
    role: 'admin' | 'user';
    mustChangePassword: boolean;
    // Personal interface language; null until the account chooses one (the device language applies).
    language: InterfaceLanguage | null;
    sessionVersion?: number;
}

export class ActorAuthorization {
    static requireReady(actor: Actor): void {
        if (actor.mustChangePassword) {
            throw new Failure('forbidden', 'Replace your temporary password first.');
        }
    }

    static requireAdmin(actor: Actor): void {
        this.requireReady(actor);

        if (actor.role !== 'admin') {
            throw new Failure('forbidden', 'Administrator access is required.');
        }
    }
}
