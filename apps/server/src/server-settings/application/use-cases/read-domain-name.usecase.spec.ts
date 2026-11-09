import { expect, it } from 'vitest';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { MemoryDomainNameStore } from '../testing/internet-access-doubles.test-support.js';
import { ReadDomainName } from './read-domain-name.usecase.js';

it('gives the saved domain name', async () => {
    const subject = new ReadDomainName(new MemoryDomainNameStore('home.example.fr'));

    const name = await subject.execute(TestActors.of('admin', 'admin'));

    expect(name).toBe('home.example.fr');
});
it('refuses an Owner', async () => {
    const subject = new ReadDomainName(new MemoryDomainNameStore('home.example.fr'));

    const result = subject.execute(TestActors.of('owner', 'olivia'));

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
