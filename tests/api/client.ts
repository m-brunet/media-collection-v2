import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export interface ApiResult<T> {
    status: number;
    body: T;
    text: string;
    bytes: Buffer;
    headers: import('node:http').IncomingHttpHeaders;
}

export const desktopWindow = { 'X-Media-Collection-Setup': 'test-setup-token' };

export class Client {
    readonly cookies = new Map<string, string>();
    private csrfToken = '';

    constructor(readonly base: string) {}

    async prepare(): Promise<void> {
        this.csrfToken = (await this.call<{ token: string }>('/auth/csrf')).body.token;
    }

    async call<T = Record<string, unknown>>(
        path: string,
        method = 'GET',
        body?: object,
        options: {
            passive?: boolean;
            csrf?: boolean;
            origin?: string;
            headers?: Record<string, string>;
            raw?: { bytes: Buffer; contentType: string };
        } = {},
    ): Promise<ApiResult<T>> {
        const url = new URL('/api' + path, this.base);
        const mutation = method !== 'GET';
        const data = options.raw
            ? options.raw.bytes
            : mutation
              ? JSON.stringify(body ?? {})
              : undefined;

        return new Promise((resolve, reject) => {
            const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(
                url,
                {
                    method,
                    rejectUnauthorized: false,
                    headers: {
                        Cookie: [...this.cookies]
                            .map(([key, value]) => key + '=' + value)
                            .join('; '),
                        ...(options.passive ? { 'X-App-Activity': 'passive' } : {}),
                        ...options.headers,
                        ...(mutation
                            ? {
                                  'Content-Type': options.raw?.contentType ?? 'application/json',
                                  'Content-Length': Buffer.byteLength(data!),
                                  Origin: options.origin ?? this.base,
                                  ...(options.csrf === false
                                      ? {}
                                      : { 'X-CSRF-Token': this.csrfToken }),
                              }
                            : {}),
                    },
                },
                (response) => {
                    for (const cookie of response.headers['set-cookie'] ?? []) {
                        const pair = cookie.split(';')[0]!;
                        const separator = pair.indexOf('=');

                        this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
                    }

                    const buffers: Buffer[] = [];

                    response.on('data', (buffer) => buffers.push(buffer));
                    response.on('end', () => {
                        const bytes = Buffer.concat(buffers);
                        const text = bytes.toString();
                        const json = String(response.headers['content-type'] ?? '').includes(
                            'json',
                        );

                        resolve({
                            status: response.statusCode ?? 0,
                            body: (text && json ? JSON.parse(text) : undefined) as T,
                            text,
                            bytes,
                            headers: response.headers,
                        });
                    });
                },
            );

            request.on('error', reject);
            request.setTimeout(10000, () =>
                request.destroy(new Error('HTTP test request timed out.')),
            );
            request.end(data);
        });
    }

    async login(username = 'admin', password = 'administrator-new-password') {
        await this.prepare();

        return this.call('/auth/login', 'POST', { username, password });
    }
}
