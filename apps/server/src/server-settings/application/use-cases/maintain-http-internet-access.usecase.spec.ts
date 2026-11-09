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
it('reports the kept rule and its public address', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles);

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'kept', address: '82.66.118.204', problem: null });
});
it('reports a rule that could not be kept', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles);

    doubles.router.connection = null;

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'failed', reason: 'no-router' });
});
it('reports an unexpected upkeep error as a rule not kept', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles);

    doubles.router.find = async () => {
        throw new Error('network down');
    };

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'failed', reason: 'setup-failed' });
});
it('reports no rule while closed', async () => {
    const doubles = InternetAccessDoubles.setup();
    const { subject } = subjectFor(doubles, new MemoryHttpInternetAccessStore());

    const outcome = await subject.execute();

    expect(outcome).toEqual({ rule: 'none' });
});
