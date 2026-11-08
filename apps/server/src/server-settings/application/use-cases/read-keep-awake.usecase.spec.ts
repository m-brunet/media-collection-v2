import { expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { MemoryKeepAwake } from '../testing/internet-access-doubles.test-support.js';
import { ReadKeepAwake } from './read-keep-awake.usecase.js';

it('is off by default', async () => {
    const subject = new ReadKeepAwake(new MemoryKeepAwake());

    const enabled = await subject.execute(TestActors.of('admin', 'admin'));

    expect(enabled).toBe(false);
});
it('refuses a Guest', async () => {
    const subject = new ReadKeepAwake(new MemoryKeepAwake());

    const result = subject.execute(TestActors.of('guest', 'gus'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
