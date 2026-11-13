import { vi } from 'vitest';
import type { Account } from '../../../../packages/contracts/src/http';
import { Required } from '../shared/required.util';

type Handler = (body: unknown) => { status: number; body?: unknown };

export class FakeApi {
    readonly calls: { route: string; body: unknown }[] = [];
    private readonly handlers = new Map<string, Handler>();

    constructor() {
        this.on('GET /auth/csrf', () => ({ status: 200, body: { token: 'csrf' } }));
        this.on('GET /auth/me', () => ({ status: 401, body: { message: 'Sign in' } }));
        this.on('GET /setup', () => ({ status: 200, body: { required: false, allowed: true } }));
        this.on('GET /appearance', () => ({ status: 200, body: { colorScheme: 'spring-green' } }));
        this.on('GET /books', () => ({ status: 200, body: { total: 0, items: [] } }));
        this.on('GET /overview', () => ({
            status: 200,
            body: {
                ownedBooks: 0,
                collections: 0,
                bookcases: 0,
                shelves: 0,
                lentBooks: 0,
                recentlyAdded: [],
                reading: { read: 0, notRead: 0 },
                bookcaseList: [],
            },
        }));
        vi.stubGlobal('fetch', vi.fn(this.fetch.bind(this)));
    }

    on(route: string, handler: Handler): this {
        this.handlers.set(route, handler);

        return this;
    }

    firstLaunch(allowed = true): this {
        return this.on('GET /setup', () => ({ status: 200, body: { required: true, allowed } }));
    }

    signedIn(account: Account): this {
        return this.on('GET /auth/me', () => ({ status: 200, body: account }));
    }

    private async fetch(input: string, init: RequestInit = {}): Promise<Response> {
        const route = (init.method ?? 'GET') + ' ' + input.replace(/^\/api/, '');
        const body =
            typeof init.body === 'string'
                ? JSON.parse(init.body)
                : init.body instanceof Blob
                  ? init.body
                  : undefined;
        const handler =
            this.handlers.get(route) ??
            this.handlers.get(Required.at(route.split('?'), 0, 'a route has a path'));

        this.calls.push({ route, body });

        if (!handler) {
            return Response.json({ message: 'Not found' }, { status: 404 });
        }

        const result = handler(body);

        if (result.body instanceof Blob) {
            return new Response(result.body, {
                status: result.status,
                headers: { 'Content-Type': result.body.type },
            });
        }

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

export function deviceLanguages(languages: string[]): void {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
}
