import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { join } from 'node:path';
import { HttpSessions } from '../../../../shared/infrastructure/adapters/driving/web/http-sessions.service.js';

export class HttpApplication {
    static create(
        sessions: HttpSessions,
        options: { development?: boolean; webDirectory?: string } = {},
    ) {
        const application = express();

        application.disable('x-powered-by');
        application.set('trust proxy', false);
        application.use(
            helmet({
                strictTransportSecurity: false,
                contentSecurityPolicy: options.development
                    ? false
                    : {
                          directives: {
                              'upgrade-insecure-requests': null,
                              // Leaf reads barcodes with a bundled WebAssembly reader; this allows
                              // compiling WebAssembly only, not JavaScript `eval`.
                              'script-src': ["'self'", "'wasm-unsafe-eval'"],
                              // A chosen cover is previewed locally before it is uploaded.
                              'img-src': ["'self'", 'data:', 'blob:'],
                          },
                      },
            }),
        );
        application.use(cookieParser());
        application.use('/api', (_request, response, next) => {
            response.setHeader('Cache-Control', 'no-store');
            next();
        });
        application.use(sessions.protect);
        application.use(express.json({ limit: '300kb' }));
        // Cover images arrive as the raw body; the books feature checks the actual content.
        application.use(
            HttpApplication.coverPath,
            express.raw({ type: () => true, limit: HttpApplication.coverLimit }),
        );
        application.use(HttpApplication.tooLarge);

        if (options.webDirectory) {
            const directory = options.webDirectory;

            application.use(express.static(directory, { index: false }));
            application.use((request, response, next) => {
                if (
                    request.method === 'GET' &&
                    !request.path.startsWith('/api') &&
                    !request.path.includes('.')
                ) {
                    response.sendFile(join(directory, HttpApplication.page(request.path)));
                } else {
                    next();
                }
            });
        }

        return application;
    }

    static readonly coverPath = /^\/api\/books\/[^/]+\/cover$/;
    static readonly uploadPaths: readonly RegExp[] = [HttpApplication.coverPath];
    // Slightly above the 10 MB cover limit so the books feature can explain a too-large image.
    private static readonly coverLimit = 10 * 1024 * 1024 + 1024;

    // Refuses oversized bodies with the API error shape instead of the default HTML page.
    private static tooLarge(
        error: unknown,
        request: Request,
        response: Response,
        next: NextFunction,
    ): void {
        if (
            error &&
            typeof error === 'object' &&
            'type' in error &&
            error.type === 'entity.too.large'
        ) {
            const cover = HttpApplication.coverPath.test(request.path);

            response.status(413).json({
                code: 'invalid_input',
                reason: cover ? 'cover-too-large' : 'request-too-large',
                message: cover ? 'The cover image is too large.' : 'The request is too large.',
            });
        } else {
            next(error);
        }
    }

    private static page(path: string): string {
        return path === '/leaf' || path.startsWith('/leaf/') ? 'leaf/index.html' : 'index.html';
    }
}
