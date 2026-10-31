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
