import type { SessionClaims } from '../../session-claims.js';

export interface SessionTokenVerifier {
    verify(token: string): Promise<SessionClaims | null>;
}
