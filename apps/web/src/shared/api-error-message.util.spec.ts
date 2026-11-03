import { expect, it } from 'vitest';
import { ApiErrorMessage } from './api-error-message.util';
import { ApiError } from './api.util';

it('describes a conflict', () => {
    const error = new ApiError('Duplicate', 409, 'conflict');

    const result = ApiErrorMessage.key(error);

    expect(result).toBe('errors.conflict');
});

it('describes a permission refusal', () => {
    const error = new ApiError('Forbidden', 403, 'forbidden');

    const result = ApiErrorMessage.key(error);

    expect(result).toBe('errors.forbidden');
});

it('describes throttled attempts', () => {
    const error = new ApiError('Slow down', 429);

    const result = ApiErrorMessage.key(error);

    expect(result).toBe('errors.tooManyAttempts');
});

it('uses a screen-specific message for a status', () => {
    const error = new ApiError('Invalid credentials', 401, 'unauthorized');

    const result = ApiErrorMessage.key(error, { 401: 'signIn.failed' });

    expect(result).toBe('signIn.failed');
});

it('prefers a screen-specific message for a failure code', () => {
    const error = new ApiError('Taken', 409, 'conflict');

    const result = ApiErrorMessage.key(error, { conflict: 'account.usernameTaken' });

    expect(result).toBe('account.usernameTaken');
});

it('reports an unreachable server as a connection problem', () => {
    const error = new TypeError('Failed to fetch');

    const result = ApiErrorMessage.key(error);

    expect(result).toBe('errors.network');
});

it('describes any other failure generically', () => {
    const error = new Error('Unexpected');

    const result = ApiErrorMessage.key(error);

    expect(result).toBe('errors.generic');
});
