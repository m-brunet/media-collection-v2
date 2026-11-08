import { expect, it } from 'vitest';
import { ReceiverBuilder } from '../testing/receiver-builder.test-support.js';
import { guest, LendingDoubles, owner } from '../testing/lending-doubles.test-support.js';
import { FindReceivers } from './find-receivers.usecase.js';

it('finds receivers by part of their name, ignoring case and accents', async () => {
    const current = LendingDoubles.lending();

    const zoe = await new ReceiverBuilder().withName('Zoé Martin').buildAndSave(current);

    await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    const result = await new FindReceivers(current.receivers).execute(owner, 'ZOE');

    expect(result).toEqual([{ id: zoe.id, name: 'Zoé Martin' }]);
});

it('suggests nothing for an empty search', async () => {
    const current = LendingDoubles.lending();

    await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    const result = await new FindReceivers(current.receivers).execute(owner, '  ');

    expect(result).toEqual([]);
});

it('suggests at most ten receivers, in name order', async () => {
    const current = LendingDoubles.lending();

    for (let index = 11; index >= 0; index--) {
        await new ReceiverBuilder()
            .withName('Sam ' + String(index).padStart(2, '0'))
            .buildAndSave(current);
    }

    const result = await new FindReceivers(current.receivers).execute(owner, 'sam');

    expect(result.map((item) => item.name)).toEqual([
        'Sam 00',
        'Sam 01',
        'Sam 02',
        'Sam 03',
        'Sam 04',
        'Sam 05',
        'Sam 06',
        'Sam 07',
        'Sam 08',
        'Sam 09',
    ]);
});

it('lets a Guest look receivers up', async () => {
    const current = LendingDoubles.lending();

    await new ReceiverBuilder().withName('Sam Taylor').buildAndSave(current);

    const result = await new FindReceivers(current.receivers).execute(guest, 'sam');

    expect(result).toHaveLength(1);
});
