import type { SessionTokenIssuer } from './session-token-issuer.interface.js';
import type { SessionTokenVerifier } from './session-token-verifier.interface.js';

export interface SessionTokens extends SessionTokenIssuer, SessionTokenVerifier {}
