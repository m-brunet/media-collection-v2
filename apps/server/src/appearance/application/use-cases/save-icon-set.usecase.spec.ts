import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { administrator, MemoryIconSetStore } from '../testing/appearance-doubles.test-support.js';
import { SaveIconSet } from './save-icon-set.usecase.js';

function subjectFor(store = new MemoryIconSetStore(), trail = new MemoryAuditTrail()) {
    return { store, trail, subject: new SaveIconSet(store, AuditDoubles.auditedOperation(trail)) };
}

it('saves the icon set chosen by the administrator', async () => {
    const { store, subject } = subjectFor();

    const result = await subject.execute(administrator, 'quiet-editorial-monoline');

    expect([result, (await store.read()).name]).toEqual([
        { iconSet: 'quiet-editorial-monoline' },
        'quiet-editorial-monoline',
    ]);
});
it('records the change in the technical audit log', async () => {
    const { trail, subject } = subjectFor();

    await subject.execute(administrator, 'single-ink-risograph');

    expect(trail.entries).toContainEqual(
        expect.objectContaining({
            category: 'appearance.icon-set-changed',
            outcome: 'successful',
            before: { iconSet: 'lucide' },
            after: { iconSet: 'single-ink-risograph' },
        }),
    );
});
it('rejects an unknown icon set without saving', async () => {
    const { store, subject } = subjectFor();

    const result = subject.execute(administrator, 'emoji');

    await expect(result).rejects.toMatchObject({ reason: 'icon-set-unknown' });
    expect((await store.read()).name).toBe('lucide');
});
it('rejects an Owner', async () => {
    const { subject } = subjectFor();

    const result = subject.execute({ ...administrator, role: 'owner' }, 'solid-silhouettes');

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
