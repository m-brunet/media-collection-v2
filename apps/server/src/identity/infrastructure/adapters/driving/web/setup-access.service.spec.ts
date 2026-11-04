import type { Request } from 'express';
import { expect, it } from 'vitest';
import { SetupAccess } from './setup-access.service.js';

function request(header?: string): Request {
    return { get: (name: string) => (name === SetupAccess.header ? header : undefined) } as Request;
}

it('allows the desktop window carrying the launch secret', () => {
    const access = new SetupAccess('launch-secret');

    const result = access.allows(request('launch-secret'));

    expect(result).toBe(true);
});

it('refuses a request without the secret, such as a browser', () => {
    const access = new SetupAccess('launch-secret');

    const result = access.allows(request());

    expect(result).toBe(false);
});

it('refuses a wrong secret', () => {
    const access = new SetupAccess('launch-secret');

    const result = access.allows(request('guessed-secret'));

    expect(result).toBe(false);
});

it('refuses every request when the backend has no secret', () => {
    const access = new SetupAccess(null);

    const result = access.allows(request('launch-secret'));

    expect(result).toBe(false);
});
