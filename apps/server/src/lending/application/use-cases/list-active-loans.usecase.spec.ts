import { expect, it } from 'vitest';
import { guest, lending, owner } from '../testing/lending-doubles.test-support.js';
import { ListActiveLoans } from './list-active-loans.usecase.js';

const query = { search: 'sam', receiverId: null };

it('lists the active loans asked for', async () => {
    const current = lending();

    current.active.groups = [{ receiver: { id: 'sam', name: 'Sam Taylor' }, loans: [] }];

    const result = await new ListActiveLoans(current.active).execute(owner, query);

    expect(result).toEqual(current.active.groups);
    expect(current.active.queries).toEqual([query]);
});

it('lets a Guest see the loans', async () => {
    const current = lending();

    const result = await new ListActiveLoans(current.active).execute(guest, query);

    expect(result).toEqual([]);
});

it('requires a replaced temporary password', async () => {
    const current = lending();

    const result = new ListActiveLoans(current.active).execute(
        { ...owner, mustChangePassword: true },
        query,
    );

    await expect(result).rejects.toMatchObject({ reason: 'temporary-password' });
});
