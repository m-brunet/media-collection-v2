import { expect, it } from 'vitest';
import { ActorAuthorization } from './actor.helper.js';

const actor = {
    id: 'one',
    username: 'one',
    role: 'owner' as const,
    mustChangePassword: false,
    language: null,
};

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
it('rejects an owner from administration', () => {
    const input = { ...actor, role: 'owner' as const };

    const operation = () => ActorAuthorization.requireAdmin(input);

    expect(operation).toThrow(expect.objectContaining({ code: 'forbidden', reason: 'admin-only' }));
});
it('lets an owner change the shared library', () => {
    const input = { ...actor, role: 'owner' as const };

    const operation = () => ActorAuthorization.requireLibraryEditor(input);

    expect(operation).not.toThrow();
});
it('lets the administrator change the shared library', () => {
    const input = { ...actor, role: 'admin' as const };

    const operation = () => ActorAuthorization.requireLibraryEditor(input);

    expect(operation).not.toThrow();
});
it('keeps a guest read-only', () => {
    const input = { ...actor, role: 'guest' as const };

    const operation = () => ActorAuthorization.requireLibraryEditor(input);

    expect(operation).toThrow(
        expect.objectContaining({ code: 'forbidden', reason: 'guest-read-only' }),
    );
});
it('requires password replacement before changing the shared library', () => {
    const input = { ...actor, mustChangePassword: true };

    const operation = () => ActorAuthorization.requireLibraryEditor(input);

    expect(operation).toThrow(
        expect.objectContaining({ code: 'forbidden', reason: 'temporary-password' }),
    );
});
