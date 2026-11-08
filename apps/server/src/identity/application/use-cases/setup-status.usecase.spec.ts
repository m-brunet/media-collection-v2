import { describe, expect, it } from 'vitest';
import { IdentityDoubles, MemoryUsers } from '../testing/identity-doubles.test-support.js';
import { SetupStatus } from './setup-status.usecase.js';

describe('SetupStatus', () => {
    it('requires setup when no account exists', async () => {
        const subject = new SetupStatus(new MemoryUsers());

        const result = await subject.execute();

        expect(result).toEqual({ required: true });
    });
    it('needs no setup once the administrator exists', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user());

        const result = await new SetupStatus(users).execute();

        expect(result).toEqual({ required: false });
    });
});
