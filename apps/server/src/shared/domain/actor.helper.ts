import { Failure } from './exceptions/failure.js';

export type InterfaceLanguage = 'en' | 'fr';

export type AccountRole = 'admin' | 'owner' | 'guest';

export interface Actor {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    language: InterfaceLanguage | null;
    sessionVersion?: number;
}

export class ActorAuthorization {
    static requireReady(actor: Actor): void {
        if (actor.mustChangePassword) {
            throw new Failure(
                'forbidden',
                'Replace your temporary password first.',
                'temporary-password',
            );
        }
    }

    static requireAdmin(actor: Actor): void {
        this.requireReady(actor);

        if (actor.role !== 'admin') {
            throw new Failure('forbidden', 'Administrator access is required.', 'admin-only');
        }
    }

    static requireLibraryEditor(actor: Actor): void {
        this.requireReady(actor);

        if (actor.role === 'guest') {
            throw new Failure(
                'forbidden',
                'Guest accounts can view the library but cannot change it.',
                'guest-read-only',
            );
        }
    }
}
