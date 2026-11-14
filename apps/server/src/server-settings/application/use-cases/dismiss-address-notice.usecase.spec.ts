import { expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import {
    InternetAccessDoubles,
    MemoryInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';
import { DismissAddressNotice } from './dismiss-address-notice.usecase.js';

const admin = TestActors.of('admin', 'admin');

it('stops telling the Admin about the new address', async () => {
    const store = new MemoryInternetAccessStore(
        InternetAccessDoubles.active({ addressMoved: true }),
    );
    const subject = new DismissAddressNotice(store);

    await subject.execute(admin);

    expect(store.current.addressMoved).toBe(false);
});
it('saves nothing when there is no notice', async () => {
    const store = new MemoryInternetAccessStore(InternetAccessDoubles.active());
    const subject = new DismissAddressNotice(store);

    await subject.execute(admin);

    expect(store.phases).toEqual([]);
});
it('refuses an Owner', async () => {
    const store = new MemoryInternetAccessStore(
        InternetAccessDoubles.active({ addressMoved: true }),
    );
    const subject = new DismissAddressNotice(store);

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
