import { describe, expect, it } from 'vitest';
import {
    FixedPasswordCheck,
    MemoryApplicationData,
} from '../testing/maintenance-doubles.test-support.js';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { ResetApplicationData } from './reset-application-data.usecase.js';

class Reset {
    readonly data = new MemoryApplicationData();
    readonly trail = new MemoryAuditTrail();

    get subject(): ResetApplicationData {
        return new ResetApplicationData(
            new FixedPasswordCheck('admin-password'),
            this.data,
            this.data,
            AuditDoubles.auditedOperation(this.trail),
        );
    }
}

describe('ResetApplicationData', () => {
    it('keeps only the Admin account', async () => {
        const reset = new Reset();

        await reset.subject.execute(TestActors.of('admin', 'admin'), 'admin-password', false);

        expect(reset.data.accounts).toEqual(['admin']);
    });
    it('returns the saved preferences to their defaults', async () => {
        const reset = new Reset();

        await reset.subject.execute(TestActors.of('admin', 'admin'), 'admin-password', false);

        expect(reset.data.preferences).toEqual({});
    });
    it('keeps the covers of the deleted books', async () => {
        const reset = new Reset();

        await reset.subject.execute(TestActors.of('admin', 'admin'), 'admin-password', false);

        expect(reset.data.covers).toEqual(['cover.jpg']);
    });
    it('deletes the kept covers too when asked', async () => {
        const reset = new Reset();

        await reset.subject.execute(TestActors.of('admin', 'admin'), 'admin-password', true);

        expect(reset.data.covers).toEqual([]);
    });
    it('removes the cover files that neither a book nor a kept cover uses', async () => {
        const reset = new Reset();

        reset.data.covers.push('orphan.jpg');
        reset.data.orphans.push('orphan.jpg');

        await reset.subject.execute(TestActors.of('admin', 'admin'), 'admin-password', false);

        expect(reset.data.covers).toEqual(['cover.jpg']);
    });
    it('records the reset by the Admin', async () => {
        const reset = new Reset();

        await reset.subject.execute(TestActors.of('admin', 'admin'), 'admin-password', false);

        expect(reset.trail.entries).toEqual([
            expect.objectContaining({
                category: 'maintenance.data-reset',
                outcome: 'successful',
                actorId: 'admin',
                subjectType: 'installation',
            }),
        ]);
    });
    it('refuses a wrong password and keeps the data', async () => {
        const reset = new Reset();

        const result = await reset.subject
            .execute(TestActors.of('admin', 'admin'), 'wrong-password', false)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'password-incorrect' });
        expect(reset.data.accounts).toEqual(['admin', 'owner', 'guest']);
        expect(reset.data.covers).toEqual(['cover.jpg']);
    });
    it('records a refused reset as failed', async () => {
        const reset = new Reset();

        await reset.subject
            .execute(TestActors.of('admin', 'admin'), 'wrong-password', false)
            .catch(() => undefined);

        expect(reset.trail.entries).toEqual([
            expect.objectContaining({
                category: 'maintenance.data-reset',
                outcome: 'failed',
                failure: 'invalid_input:password-incorrect',
            }),
        ]);
    });
    it('refuses an Owner', async () => {
        const reset = new Reset();

        const result = await reset.subject
            .execute(TestActors.of('owner', 'owner'), 'admin-password', false)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ code: 'forbidden', reason: 'admin-only' });
        expect(reset.data.accounts).toEqual(['admin', 'owner', 'guest']);
    });
    it('refuses a Guest', async () => {
        const reset = new Reset();

        const result = await reset.subject
            .execute(TestActors.of('guest', 'guest'), 'admin-password', false)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ code: 'forbidden', reason: 'admin-only' });
        expect(reset.data.accounts).toEqual(['admin', 'owner', 'guest']);
    });
    it('refuses an Admin who must first replace a temporary password', async () => {
        const reset = new Reset();

        const result = await reset.subject
            .execute(TestActors.of('admin', 'admin', true), 'admin-password', false)
            .catch((error: unknown) => error);

        expect(result).toMatchObject({ reason: 'temporary-password' });
        expect(reset.data.accounts).toEqual(['admin', 'owner', 'guest']);
    });
});
