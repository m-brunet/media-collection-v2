import { expect, it } from 'vitest';
import { Failure } from './failure.js';

it('preserves the application failure contract', () => {
    const code = 'conflict';
    const message = 'Duplicate';

    const result = new Failure(code, message);

    expect(result).toMatchObject({ code, message, name: 'Failure' });
    expect(result).toBeInstanceOf(Error);
});
it('reports a failed invariant', () => {
    const message = 'Required';

    const operation = () => Failure.ensure(false, message);

    expect(operation).toThrow(expect.objectContaining({ code: 'invalid_input', message }));
});
it('accepts a satisfied invariant', () => {
    const condition = true;

    const operation = () => Failure.ensure(condition, 'Required');

    expect(operation).not.toThrow();
});
it('carries a stable reason for translation', () => {
    const reason = 'username-taken';

    const result = new Failure('conflict', 'Taken', reason);

    expect(result.reason).toBe(reason);
});
it('reports a failed invariant with its reason', () => {
    const reason = 'password-length';

    const operation = () => Failure.ensure(false, 'Too short', reason);

    expect(operation).toThrow(expect.objectContaining({ code: 'invalid_input', reason }));
});
it('has no reason unless one is given', () => {
    const message = 'Duplicate';

    const result = new Failure('conflict', message);

    expect(result.reason).toBeNull();
});
it('carries details needed to resolve the failure', () => {
    const details = { candidates: [{ id: 'a', name: 'Sam Taylor' }] };

    const result = new Failure('conflict', 'Similar', 'author-similar', details);

    expect(result.details).toEqual(details);
});
it('names a failure with its reason for the audit log', () => {
    const failure = new Failure('conflict', 'Taken', 'username-taken');

    const result = Failure.auditCode(failure);

    expect(result).toBe('conflict:username-taken');
});
it('names a failure without reason by its code', () => {
    const failure = new Failure('not_found', 'Missing');

    const result = Failure.auditCode(failure);

    expect(result).toBe('not_found');
});
it('names an unexpected error generically', () => {
    const error = new Error('disk full');

    const result = Failure.auditCode(error);

    expect(result).toBe('error');
});
