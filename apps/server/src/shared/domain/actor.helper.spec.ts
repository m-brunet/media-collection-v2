import { expect, it } from 'vitest';
import { ActorAuthorization } from './actor.helper.js';

const actor = { id: 'one', username: 'one', role: 'user' as const, mustChangePassword: false };

it('permits completed setup', () => {
    const input = { ...actor };

    const operation = () => ActorAuthorization.requireReady(input);

    expect(operation).not.toThrow();
});
it('requires password replacement for ordinary actions', () => {
    const input = { ...actor, mustChangePassword: true };

    const operation = () => ActorAuthorization.requireReady(input);

    expect(operation).toThrow(expect.objectContaining({ code: 'forbidden' }));
});
it('permits ready administrators', () => {
    const input = { ...actor, role: 'admin' as const };

    const operation = () => ActorAuthorization.requireAdmin(input);

    expect(operation).not.toThrow();
});
it('rejects a non-administrator', () => {
    const input = { ...actor };
    const candidate = { ...input };

    const operation = () => ActorAuthorization.requireAdmin(candidate);

    expect(operation).toThrow(expect.objectContaining({ code: 'forbidden' }));
});
it('rejects an administrator with incomplete password setup', () => {
    const input = { ...actor, role: 'admin' as const, mustChangePassword: true };
    const candidate = { ...input };

    const operation = () => ActorAuthorization.requireAdmin(candidate);

    expect(operation).toThrow(expect.objectContaining({ code: 'forbidden' }));
});
