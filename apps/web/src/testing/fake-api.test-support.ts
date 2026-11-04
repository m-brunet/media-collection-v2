import { vi } from 'vitest';
import type { Account } from '../../../../packages/contracts/src/http';

type Handler = (body: unknown) => { status: number; body?: unknown };

// Replaces `fetch` with scripted API responses, keyed by "METHOD /path" (without `/api`).
export class FakeApi {
    readonly calls: { route: string; body: unknown }[] = [];
    private readonly handlers = new Map<string, Handler>();

    constructor() {
        this.on('GET /auth/csrf', () => ({ status: 200, body: { token: 'csrf' } }));
        this.on('GET /auth/me', () => ({ status: 401, body: { message: 'Sign in' } }));
        this.on('GET /setup', () => ({ status: 200, body: { required: false, local: true } }));
        vi.stubGlobal('fetch', vi.fn(this.fetch.bind(this)));
    }

    on(route: string, handler: Handler): this {
        this.handlers.set(route, handler);

        return this;
    }

    // First launch: no account exists yet; `local` tells whether this device may complete setup.
    firstLaunch(local = true): this {
        return this.on('GET /setup', () => ({ status: 200, body: { required: true, local } }));
    }

    signedIn(account: Account): this {
        return this.on('GET /auth/me', () => ({ status: 200, body: account }));
    }

    private async fetch(input: string, init: RequestInit = {}): Promise<Response> {
        const route = (init.method ?? 'GET') + ' ' + input.replace(/^\/api/, '');
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
        const handler = this.handlers.get(route);

        this.calls.push({ route, body });

        if (!handler) {
            return Response.json({ message: 'Not found' }, { status: 404 });
        }

        const result = handler(body);

        return result.status === 204
            ? new Response(null, { status: 204 })
            : Response.json(result.body ?? {}, { status: result.status });
    }
}

export function account(overrides: Partial<Account> = {}): Account {
    return {
        id: 'alex',
        username: 'alex',
        role: 'owner',
        mustChangePassword: false,
        language: null,
        ...overrides,
    };
}

// Simulates the browser/device language list seen by the interface.
export function deviceLanguages(languages: string[]): void {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
}
