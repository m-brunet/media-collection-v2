import { expect, it } from 'vitest';
import {
    InternetAccessDoubles,
    MemoryHttpInternetAccessStore,
} from '../testing/internet-access-doubles.test-support.js';
import { HttpInternetAccessClosing } from './http-internet-access-closing.service.js';

function closingFor(store: MemoryHttpInternetAccessStore) {
    const doubles = InternetAccessDoubles.setup();

    return { doubles, closing: new HttpInternetAccessClosing(store, doubles.forwarding) };
}

it('closes open HTTP and removes its router rule', async () => {
    const store = new MemoryHttpInternetAccessStore(InternetAccessDoubles.httpOpen());
    const { doubles, closing } = closingFor(store);

    await closing.becauseHttpsWorks();

    expect([store.current.phase, store.current.closedByHttps, doubles.router.closed]).toEqual([
        'off',
        true,
        [{ externalPort: 34345, internalPort: 34345 }],
    ]);
});
it('closes HTTP even when the router does not answer', async () => {
    const store = new MemoryHttpInternetAccessStore(InternetAccessDoubles.httpOpen());
    const { doubles, closing } = closingFor(store);

    doubles.router.close = async () => {
        throw new Error('router gone');
    };

    await closing.becauseHttpsWorks();

    expect([store.current.phase, store.current.closedByHttps]).toEqual(['off', true]);
});
it('leaves closed HTTP as it is', async () => {
    const store = new MemoryHttpInternetAccessStore();
    const { doubles, closing } = closingFor(store);

    await closing.becauseHttpsWorks();

    expect([store.current.closedByHttps, doubles.router.closed]).toEqual([false, []]);
});
