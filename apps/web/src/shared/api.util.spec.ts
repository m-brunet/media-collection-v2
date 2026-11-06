import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let api: typeof import('./api.util.js').api;
let dispatch: ReturnType<typeof vi.fn>;
const fetchResponse = (status: number, body: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

beforeEach(async () => {
    vi.resetModules();
    dispatch = vi.fn();
    vi.stubGlobal('window', { dispatchEvent: dispatch });
    api = (await import('./api.util.js')).api;
});
afterEach(() => {
    vi.unstubAllGlobals();
});

it('sends passive GET requests with same-origin credentials', async () => {
    const fetch = vi.fn().mockResolvedValue(fetchResponse(200, { ready: true }));

    vi.stubGlobal('fetch', fetch);
    const options = { passive: true };

    const result = await api.request('/health', options);

    expect(result).toEqual({ ready: true });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
        '/api/health',
        expect.objectContaining({
            method: 'GET',
            credentials: 'same-origin',
            headers: { 'X-App-Activity': 'passive' },
        }),
    );
});

it('prepares CSRF and JSON for a mutation', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(fetchResponse(200, { token: 'csrf-token' }))
        .mockResolvedValueOnce(fetchResponse(201, { id: 'note' }));

    vi.stubGlobal('fetch', fetch);
    const input = { title: 'Title', body: '' };

    const result = await api.request('/notes', { method: 'POST', body: input });

    expect(result).toEqual({ id: 'note' });
    expect(fetch).toHaveBeenLastCalledWith(
        '/api/notes',
        expect.objectContaining({
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'csrf-token' },
        }),
    );
});

it('returns no body for a 204 response', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(fetchResponse(200, { token: 'csrf-token' }))
        .mockResolvedValueOnce(fetchResponse(204, undefined));

    vi.stubGlobal('fetch', fetch);
    const options = { method: 'POST' };

    const result = await api.request('/auth/logout', options);

    expect(result).toBeUndefined();
});

it('signals session expiry for protected responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchResponse(401, { message: 'Sign in' })));
    const path = '/auth/me';

    const result = api.request(path);

    await expect(result).rejects.toMatchObject({ status: 401, message: 'Sign in' });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]![0].type).toBe('session-expired');
});

it('does not signal session expiry for a failed login', async () => {
    vi.stubGlobal(
        'fetch',
        vi
            .fn()
            .mockResolvedValueOnce(fetchResponse(200, { token: 'csrf-token' }))
            .mockResolvedValueOnce(fetchResponse(401, { message: 'Wrong credentials' })),
    );
    const options = { method: 'POST', body: { username: 'owner', password: 'wrong' } };

    const result = api.request('/auth/login', options);

    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(dispatch).not.toHaveBeenCalled();
});

it('reprepares CSRF after a rejected mutation', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(fetchResponse(200, { token: 'old' }))
        .mockResolvedValueOnce(fetchResponse(403, { message: 'Rejected' }))
        .mockResolvedValueOnce(fetchResponse(200, { token: 'new' }))
        .mockResolvedValueOnce(fetchResponse(201, { id: 'note' }));

    vi.stubGlobal('fetch', fetch);
    await api.request('/notes', { method: 'POST' }).then(
        () => {
            throw new Error('Setup mutation should fail');
        },
        (error) => {
            if (!(error instanceof Error && 'status' in error && error.status === 403)) {
                throw error;
            }
        },
    );
    const options = { method: 'POST', body: { title: 'Title', body: '' } };

    const result = await api.request('/notes', options);

    expect(result).toEqual({ id: 'note' });
    expect(fetch).toHaveBeenLastCalledWith(
        '/api/notes',
        expect.objectContaining({
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'new' },
        }),
    );
});

it('signals session expiry when a download is refused', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchResponse(401, { message: 'Sign in' })));
    const path = '/books/lookups/covers/token';

    const result = api.download(path);

    await expect(result).rejects.toMatchObject({ status: 401, message: 'Sign in' });
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]![0].type).toBe('session-expired');
});

it('reprepares CSRF after a rejected download', async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(fetchResponse(200, { token: 'old' }))
        .mockResolvedValueOnce(fetchResponse(403, { message: 'Rejected' }))
        .mockResolvedValueOnce(fetchResponse(200, { token: 'new' }))
        .mockResolvedValueOnce({ ...fetchResponse(200, null), blob: async () => new Blob() });

    vi.stubGlobal('fetch', fetch);
    await api.download('/books/lookups/covers', { address: 'https://a.example/1.jpg' }).then(
        () => {
            throw new Error('Setup download should fail');
        },
        (error) => {
            if (!(error instanceof Error && 'status' in error && error.status === 403)) {
                throw error;
            }
        },
    );
    const body = { address: 'https://a.example/2.jpg' };

    await api.download('/books/lookups/covers', body);

    expect(fetch).toHaveBeenLastCalledWith(
        '/api/books/lookups/covers',
        expect.objectContaining({
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'new' },
        }),
    );
});
