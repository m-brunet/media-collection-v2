import express from 'express';
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
                    : { directives: { 'upgrade-insecure-requests': null } },
            }),
        );
        application.use(cookieParser());
        application.use('/api', (_request, response, next) => {
            response.setHeader('Cache-Control', 'no-store');
            next();
        });
        application.use(sessions.protect);
        application.use(express.json({ limit: '300kb' }));

        if (options.webDirectory) {
            const directory = options.webDirectory;

            application.use(express.static(directory, { index: false }));
            application.use((request, response, next) => {
                if (
                    request.method === 'GET' &&
                    !request.path.startsWith('/api') &&
                    !request.path.includes('.')
                ) {
                    response.sendFile(join(directory, 'index.html'));
                } else {
                    next();
                }
            });
        }

        return application;
    }
}
