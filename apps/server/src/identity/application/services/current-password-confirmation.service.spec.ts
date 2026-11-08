import { expect, it } from 'vitest';
import { CurrentPasswordConfirmation } from './current-password-confirmation.service.js';
import { IdentityDoubles, passwords } from '../testing/identity-doubles.test-support.js';

it('accepts a matching current password', async () => {
    const subject = new CurrentPasswordConfirmation(passwords);
    const account = IdentityDoubles.user();

    const result = subject.confirm(account, 'old-password');

    await expect(result).resolves.toBeUndefined();
});
it('rejects an incorrect current password', async () => {
    const subject = new CurrentPasswordConfirmation(passwords);
    const account = IdentityDoubles.user();

    const result = subject.confirm(account, 'wrong');

    await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
});
