import type { SessionClaims } from '../../session-claims.js';

export interface SessionTokenIssuer {
    issue(claims: SessionClaims): Promise<string>;
}
