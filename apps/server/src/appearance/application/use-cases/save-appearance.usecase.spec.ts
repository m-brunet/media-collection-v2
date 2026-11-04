import { describe, expect, it } from 'vitest';
import {
    auditedOperation,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import {
    administrator,
    MemoryAppearanceStore,
} from '../testing/appearance-doubles.test-support.js';
import { SaveAppearance } from './save-appearance.usecase.js';

describe('SaveAppearance', () => {
    it('saves the chosen colour scheme for the whole installation', async () => {
        const store = new MemoryAppearanceStore();
        const subject = new SaveAppearance(store, auditedOperation(new MemoryAuditTrail()));

        const result = await subject.execute(administrator, 'mint');

        expect(result).toEqual({ colorScheme: 'mint' });
        expect((await store.read()).name).toBe('mint');
    });
    it('records the change with the previous and new scheme', async () => {
        const trail = new MemoryAuditTrail();
        const subject = new SaveAppearance(new MemoryAppearanceStore(), auditedOperation(trail));

        await subject.execute(administrator, 'emerald');

        expect(trail.entries).toEqual([
            expect.objectContaining({
                category: 'appearance.color-scheme-changed',
                outcome: 'successful',
                before: { colorScheme: 'spring-green' },
                after: { colorScheme: 'emerald' },
            }),
        ]);
    });
    it('rejects an unknown scheme without changing the saved one', async () => {
        const store = new MemoryAppearanceStore();
        const subject = new SaveAppearance(store, auditedOperation(new MemoryAuditTrail()));

        const result = subject.execute(administrator, 'purple');

        await expect(result).rejects.toMatchObject({ reason: 'color-scheme-unknown' });
        expect((await store.read()).name).toBe('spring-green');
    });
    it('refuses an Owner', async () => {
        const store = new MemoryAppearanceStore();
        const subject = new SaveAppearance(store, auditedOperation(new MemoryAuditTrail()));

        const result = subject.execute({ ...administrator, role: 'owner' }, 'mint');

        await expect(result).rejects.toMatchObject({ code: 'forbidden', reason: 'admin-only' });
        expect((await store.read()).name).toBe('spring-green');
    });
});
