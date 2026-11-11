import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { SessionLifetime } from '../../../../domain/session-lifetime.helper.js';

export class HttpSessions {
    constructor(
        private readonly secret: Uint8Array,
        private readonly uploadPaths: readonly RegExp[] = [],
    ) {}

    token(request: Request): string | undefined {
        return this.cookie(request, this.names(request).auth);
    }

    set(request: Request, response: Response, token: string): void {
        response.cookie(this.names(request).auth, token, {
            ...this.options(request),
            maxAge: SessionLifetime.milliseconds,
        });
    }

    clear(request: Request, response: Response): void {
        const names = this.names(request);

        response.clearCookie(names.auth, this.options(request));
        response.clearCookie(names.csrf, this.options(request));
    }

    csrf(request: Request, response: Response): string {
        const name = this.names(request).csrf;
        const existing = this.cookie(request, name);

        if (existing && this.valid(existing)) {
            return existing;
        }

        const nonce = randomBytes(32).toString('base64url');
        const token = nonce + '.' + this.sign(nonce);

        response.cookie(name, token, this.options(request));

        return token;
    }

    protect = (request: Request, response: Response, next: NextFunction): void => {
        if (
            !request.path.startsWith('/api') ||
            ['GET', 'HEAD', 'OPTIONS'].includes(request.method)
        ) {
            next();

            return;
        }

        const expectedOrigin = request.protocol + '://' + request.get('host');
        const supplied = request.get('x-csrf-token');
        const cookie = this.cookie(request, this.names(request).csrf);

        if (
            request.get('origin') !== expectedOrigin ||
            !this.acceptedBody(request) ||
            !supplied ||
            supplied !== cookie ||
            !this.valid(supplied)
        ) {
            response.status(403).json({
                code: 'forbidden',
                message: 'The request security check failed. Reload the page and try again.',
            });

            return;
        }

        next();
    };

    private acceptedBody(request: Request): boolean {
        return (
            Boolean(request.is('application/json')) ||
            (this.uploadPaths.some((path) => path.test(request.path)) &&
                Boolean(request.is(['image/*', 'application/octet-stream'])))
        );
    }

    private names(request: Request): { auth: string; csrf: string } {
        return request.secure
            ? { auth: '__Secure-app_auth', csrf: '__Secure-app_csrf' }
            : { auth: 'app_auth', csrf: 'app_csrf' };
    }

    private options(request: Request) {
        return { httpOnly: true, secure: request.secure, sameSite: 'lax' as const, path: '/api' };
    }

    private cookie(request: Request, name: string): string | undefined {
        return (request.cookies as Record<string, string | undefined> | undefined)?.[name];
    }

    private sign(nonce: string): string {
        return createHmac('sha256', this.secret).update(nonce).digest('base64url');
    }

    private valid(value: string): boolean {
        const [nonce, signature, extra] = value.split('.');

        if (!nonce || !signature || extra || nonce.length !== 43) {
            return false;
        }

        const expected = Buffer.from(this.sign(nonce));
        const actual = Buffer.from(signature);

        return actual.length === expected.length && timingSafeEqual(actual, expected);
    }
}
