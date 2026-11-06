import { expect, it } from 'vitest';
import { lending } from './lending-doubles.test-support.js';
import { ReceiverBuilder } from './receiver-builder.test-support.js';

it('builds receivers with distinct default names', () => {
    const first = new ReceiverBuilder().build();

    const result = new ReceiverBuilder().build();

    expect(result.key).not.toBe(first.key);
});

it('builds a receiver with the chosen name and identity', () => {
    const builder = new ReceiverBuilder().withId('sam').withName('Sam Taylor');

    const result = builder.build();

    expect(result.snapshot).toEqual({
        id: 'sam',
        name: 'Sam Taylor',
        createdAt: '2026-01-01T00:00:00.000Z',
    });
});

it('saves the receiver through the repository', async () => {
    const current = lending();

    const result = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    expect((await current.receivers.findById(result.id))?.snapshot.name).toBe('Sam Taylor');
});
