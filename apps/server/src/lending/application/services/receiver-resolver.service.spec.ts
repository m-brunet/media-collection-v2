import { expect, it } from 'vitest';
import { ReceiverBuilder } from '../testing/receiver-builder.test-support.js';
import { LendingDoubles } from '../testing/lending-doubles.test-support.js';

it('creates a receiver for a new name', async () => {
    const current = LendingDoubles.lending();

    const result = await current.resolver.resolve({ name: ' Sam Taylor ' });

    expect(result.created).toBe(true);
    expect(result.receiver.snapshot).toEqual({
        id: 'id-1',
        name: 'Sam Taylor',
        createdAt: '2026-10-30T09:00:00.000Z',
    });
    expect(current.receivers.receivers.has('id-1')).toBe(true);
});

it('reuses the receiver chosen by its identity', async () => {
    const current = LendingDoubles.lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    const result = await current.resolver.resolve({ id: sam.id });

    expect(result).toMatchObject({ created: false, receiver: { id: sam.id } });
});

it('reuses the receiver with an equivalent name', async () => {
    const current = LendingDoubles.lending();
    const sam = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    const result = await current.resolver.resolve({ name: 'SAM TAYLOR' });

    expect(result).toMatchObject({ created: false, receiver: { id: sam.id } });
});

it('names every similar receiver instead of creating one', async () => {
    const current = LendingDoubles.lending();
    const taylor = await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);
    const tailor = await new ReceiverBuilder().withName('Sam Tailor').buildAndSave(current);

    const result = current.resolver.resolve({ name: 'Sam Tayler' });

    await expect(result).rejects.toMatchObject({
        reason: 'receiver-similar',
        details: {
            name: 'Sam Tayler',
            candidates: [
                { id: tailor.id, name: 'Sam Tailor' },
                { id: taylor.id, name: 'Sam Taylor' },
            ],
        },
    });
});

it('creates a confirmed distinct receiver despite a similar name', async () => {
    const current = LendingDoubles.lending();

    await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    const result = await current.resolver.resolve({ name: 'Sam Tayler', distinct: true });

    expect(result).toMatchObject({ created: true, receiver: { snapshot: { name: 'Sam Tayler' } } });
});

it('refuses an unknown receiver identity', async () => {
    const current = LendingDoubles.lending();

    const result = current.resolver.resolve({ id: 'gone' });

    await expect(result).rejects.toMatchObject({ code: 'not_found', reason: 'receiver-missing' });
});
