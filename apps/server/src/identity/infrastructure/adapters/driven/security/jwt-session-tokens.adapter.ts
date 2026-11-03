import { jwtVerify, SignJWT } from 'jose';
import type { SessionClaims } from '../../../../application/session-claims.js';
import type { SessionTokens } from '../../../../application/ports/driven/session-tokens.interface.js';
import type { Clock } from '../../../../../shared/application/ports/driven/clock.interface.js';

export class JwtSessionTokens implements SessionTokens {
    constructor(
        private readonly key: Uint8Array,
        private readonly clock: Clock,
    ) {}

    async issue(claims: SessionClaims): Promise<string> {
        const now = Math.floor(this.clock.now().getTime() / 1000);

        return new SignJWT({ version: claims.version, restricted: claims.restricted })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject(claims.userId)
            .setIssuer('media-collection')
            .setAudience('media-collection-web')
            .setIssuedAt(now)
            .setExpirationTime(now + 3600)
            .sign(this.key);
    }

    async verify(token: string): Promise<SessionClaims | null> {
        try {
            const { payload } = await jwtVerify(token, this.key, {
                algorithms: ['HS256'],
                issuer: 'media-collection',
                audience: 'media-collection-web',
                currentDate: this.clock.now(),
            });

            if (
                typeof payload.sub !== 'string' ||
                typeof payload.version !== 'number' ||
                typeof payload.restricted !== 'boolean'
            ) {
                return null;
            }

            return {
                userId: payload.sub,
                version: payload.version,
                restricted: payload.restricted,
            };
        } catch {
            return null;
        }
    }
}
