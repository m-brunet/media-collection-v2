import { expect, it } from 'vitest';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { MemoryInternetAccessStore } from '../testing/internet-access-doubles.test-support.js';
import { DismissSetupFailure } from './dismiss-setup-failure.usecase.js';

const admin = TestActors.of('admin', 'admin');

function stopped() {
    return {
        ...InternetAccess.off().snapshot,
        failure: { reason: 'setup-failed' as const, at: '2026-11-08T10:00:00.000Z' },
    };
}

it('stops telling the Admin about a stopped setup', async () => {
    const store = new MemoryInternetAccessStore(stopped());
    const subject = new DismissSetupFailure(store);

    await subject.execute(admin);

    expect(store.current.failure).toBeNull();
});
it('saves nothing when there is no stopped setup', async () => {
    const store = new MemoryInternetAccessStore(InternetAccess.off().snapshot);
    const subject = new DismissSetupFailure(store);

    await subject.execute(admin);

    expect(store.phases).toEqual([]);
});
it('refuses an Owner', async () => {
    const store = new MemoryInternetAccessStore(stopped());
    const subject = new DismissSetupFailure(store);

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
    expect(store.current.failure).not.toBeNull();
});
