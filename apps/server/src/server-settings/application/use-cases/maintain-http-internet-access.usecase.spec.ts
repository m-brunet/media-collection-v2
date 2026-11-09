import { expect, it } from 'vitest';
import {
    InternetAccessDoubles,
    MemoryHttpInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';
import { MaintainHttpInternetAccess } from './maintain-http-internet-access.usecase.js';

function subjectFor(
    doubles: ReturnType<typeof InternetAccessDoubles.setup>,
    store = new MemoryHttpInternetAccessStore(InternetAccessDoubles.httpOpen()),
) {
    return {
        store,
        subject: new MaintainHttpInternetAccess(store, doubles.forwarding, doubles.clock),
    };
}

it('recreates the router rule while open', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles);

    await subject.execute();

    expect(doubles.router.opened).toEqual([{ externalPort: 34345, internalPort: 34345 }]);
});
it('saves a new public address', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject, store } = subjectFor(doubles);

    doubles.router.connection = { mapping: 'upnp', externalAddress: '82.66.118.77' };

    await subject.execute();

    expect(store.current.publicAddress).toBe('82.66.118.77');
});
it('does nothing while closed', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles, new MemoryHttpInternetAccessStore());

    await subject.execute();

    expect(doubles.router.opened).toEqual([]);
});
it('records an unexpected upkeep error as a failure', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject, store } = subjectFor(doubles);

    doubles.router.find = async () => {
        throw new Error('network down');
    };

    await subject.execute();

    expect([store.current.phase, store.current.failure?.reason]).toEqual(['open', 'setup-failed']);
});
