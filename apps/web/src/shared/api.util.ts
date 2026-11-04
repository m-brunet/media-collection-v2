export class ApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        // Stable server failure code (for example `conflict`), when the server supplied one.
        public readonly code: string | null = null,
        // Precise stable cause (for example `username-taken`), translated by the interface.
        public readonly reason: string | null = null,
    ) {
        super(message);
    }
}

export class ApiClient {
    private csrfToken: string | undefined;
    private csrfRequest: Promise<string> | undefined;

    async request<T>(
        path: string,
        options: { method?: string; body?: unknown; passive?: boolean } = {},
    ): Promise<T> {
        const method = options.method ?? 'GET';
        const headers: Record<string, string> = {};

        if (options.passive) {
            headers['X-App-Activity'] = 'passive';
        }

        if (method !== 'GET') {
            headers['Content-Type'] = 'application/json';
            headers['X-CSRF-Token'] = await this.csrf();
        }

        const response = await fetch('/api' + path, {
            method,
            headers,
            credentials: 'same-origin',
            body: method !== 'GET' ? JSON.stringify(options.body ?? {}) : undefined,
        });

        if (!response.ok) {
            const result = (await response
                .json()
                .catch(() => ({ message: 'The request failed.' }))) as {
                message: string;
                code?: string;
                reason?: string | null;
            };

            if (response.status === 401 && path !== '/auth/login') {
                window.dispatchEvent(new Event('session-expired'));
            }

            if (response.status === 403) {
                this.csrfToken = undefined;
            }

            throw new ApiError(
                result.message,
                response.status,
                result.code ?? null,
                result.reason ?? null,
            );
        }

        if (path === '/auth/logout') {
            this.csrfToken = undefined;
        }

        return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
    }

    private async csrf(): Promise<string> {
        if (this.csrfToken) {
            return this.csrfToken;
        }

        this.csrfRequest ??= fetch('/api/auth/csrf', { credentials: 'same-origin' })
            .then(async (response) => {
                if (!response.ok) {
                    throw new ApiError(
                        'Could not prepare a secure request. Reload the page.',
                        response.status,
                    );
                }

                const result = (await response.json()) as { token: string };

                this.csrfToken = result.token;

                return result.token;
            })
            .finally(() => {
                this.csrfRequest = undefined;
            });

        return this.csrfRequest;
    }
}

export const api = new ApiClient();
