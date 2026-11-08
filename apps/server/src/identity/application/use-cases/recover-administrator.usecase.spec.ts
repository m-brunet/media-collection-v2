import { describe, expect, it } from 'vitest';
import {
    IdentityDoubles,
    MemoryUsers,
    passwords,
} from '../testing/identity-doubles.test-support.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { RecoverAdministrator } from './recover-administrator.usecase.js';

describe('RecoverAdministrator', () => {
    it('sets a temporary password and ends the administrator sessions', async () => {
        const users = new MemoryUsers();

        await users.create(
            IdentityDoubles.user({ id: 'admin', username: 'Alex', tokenVersion: 1 }),
        );
        const subject = new RecoverAdministrator(
            users,
            passwords,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = await subject.execute('recovered-password');

        expect(result).toEqual({ username: 'Alex' });
        expect((await users.findById('admin'))!.snapshot).toMatchObject({
            passwordHash: 'hash:recovered-password',
            tokenVersion: 2,
            mustChangePassword: true,
        });
    });
    it('leaves the other accounts unchanged', async () => {
        const users = new MemoryUsers();
        const member = IdentityDoubles.user({ id: 'member', username: 'member', role: 'owner' });

        await users.create(IdentityDoubles.user({ id: 'admin', username: 'Alex' }));
        await users.create(member);
        const subject = new RecoverAdministrator(
            users,
            passwords,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        await subject.execute('recovered-password');

        expect((await users.findById('member'))!.snapshot).toEqual(member.snapshot);
    });
    it('records the recovery without an acting account', async () => {
        const users = new MemoryUsers();
        const trail = new MemoryAuditTrail();

        await users.create(IdentityDoubles.user({ id: 'admin', username: 'Alex' }));
        const subject = new RecoverAdministrator(
            users,
            passwords,
            AuditDoubles.auditedOperation(trail),
        );

        await subject.execute('recovered-password');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.recovered',
                outcome: 'successful',
                actorId: null,
                subjectType: 'account',
                subjectId: 'admin',
                before: expect.objectContaining({ mustChangePassword: false }),
                after: expect.objectContaining({ mustChangePassword: true }),
            }),
        ]);
    });
    it('keeps the password hash out of the audit record', async () => {
        const users = new MemoryUsers();
        const trail = new MemoryAuditTrail();

        await users.create(IdentityDoubles.user({ id: 'admin', username: 'Alex' }));
        const subject = new RecoverAdministrator(
            users,
            passwords,
            AuditDoubles.auditedOperation(trail),
        );

        await subject.execute('recovered-password');

        expect(JSON.stringify(trail.entries)).not.toContain('hash:');
    });
    it('rejects an installation without an administrator', async () => {
        const subject = new RecoverAdministrator(
            new MemoryUsers(),
            passwords,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute('recovered-password');

        await expect(result).rejects.toMatchObject({
            code: 'not_found',
            reason: 'administrator-missing',
        });
    });
    it('rejects a short recovery password', async () => {
        const users = new MemoryUsers();

        await users.create(IdentityDoubles.user({ id: 'admin', username: 'Alex' }));
        const subject = new RecoverAdministrator(
            users,
            passwords,
            AuditDoubles.auditedOperation(new MemoryAuditTrail()),
        );

        const result = subject.execute('short');

        await expect(result).rejects.toMatchObject({ code: 'invalid_input' });
    });
    it('records a refused recovery as failed', async () => {
        const users = new MemoryUsers();
        const trail = new MemoryAuditTrail();

        await users.create(IdentityDoubles.user({ id: 'admin', username: 'Alex' }));
        const subject = new RecoverAdministrator(
            users,
            passwords,
            AuditDoubles.auditedOperation(trail),
        );

        const result = await subject.execute('short').catch((error: unknown) => error);

        expect(result).toMatchObject({ code: 'invalid_input' });
        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'account.recovered',
                outcome: 'failed',
                subjectId: 'admin',
                failure: 'invalid_input:password-length',
            }),
        ]);
    });
});
