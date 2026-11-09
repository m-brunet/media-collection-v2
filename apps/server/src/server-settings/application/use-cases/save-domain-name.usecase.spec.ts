import { expect, it } from 'vitest';
import {
    AuditDoubles,
    MemoryAuditTrail,
} from '../../../shared/application/testing/audit-doubles.test-support.js';
import { TestActors } from '../../../shared/application/testing/test-actors.test-support.js';
import { PublicAddressLookup } from '../services/public-address-lookup.service.js';
import {
    InternetAccessDoubles,
    publicAddress,
} from '../testing/internet-access-doubles.test-support.js';
import { SaveDomainName } from './save-domain-name.usecase.js';

const admin = TestActors.of('admin', 'admin');
const domainCertificate = {
    address: 'home.example.fr',
    issuedAt: '2026-11-08T10:00:00.000Z',
    expiresAt: '2027-02-06T10:00:00.000Z',
};

function subjectFor(
    doubles: ReturnType<typeof InternetAccessDoubles.setup>,
    trail = new MemoryAuditTrail(),
) {
    return new SaveDomainName(
        doubles.names,
        new PublicAddressLookup(doubles.router, doubles.probe),
        doubles.domains,
        doubles.setup,
        doubles.background,
        AuditDoubles.auditedOperation(trail),
    );
}

it('saves a domain name that points to this connection', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const saved = await subject.execute(admin, { domain: ' Home.Example.fr ' });

    expect([saved, doubles.names.name]).toEqual(['home.example.fr', 'home.example.fr']);
});
it('removes the domain name when the field is empty', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    doubles.names.name = 'home.example.fr';

    const saved = await subject.execute(admin, { domain: '' });

    expect([saved, doubles.names.name, doubles.resolver.asked]).toEqual([null, null, []]);
});
it('refuses a domain name that points elsewhere and keeps the saved one', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    doubles.names.name = 'old.example.fr';
    doubles.resolver.answer = ['82.66.118.77'];

    const result = subject.execute(admin, { domain: 'home.example.fr' });

    await expect(result).rejects.toMatchObject({
        code: 'invalid_input',
        reason: 'domain-mismatch',
        details: { publicAddress },
    });
    expect(doubles.names.name).toBe('old.example.fr');
});
it('refuses a domain name without an address', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    doubles.resolver.answer = [];

    const result = subject.execute(admin, { domain: 'home.example.fr' });

    await expect(result).rejects.toMatchObject({ reason: 'domain-unresolved' });
});
it('refuses a domain name when the public address cannot be found', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    doubles.router.connection = null;
    doubles.probe.address = null;

    const result = subject.execute(admin, { domain: 'home.example.fr' });

    await expect(result).rejects.toMatchObject({ reason: 'public-address-unknown' });
});
it('refuses an invalid domain name', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const result = subject.execute(admin, { domain: 'home.example.fr:3443' });

    await expect(result).rejects.toMatchObject({ reason: 'domain-name-invalid' });
});
it('refuses an Owner', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    const result = subject.execute(TestActors.of('owner', 'olivia'), {
        domain: 'home.example.fr',
    });

    await expect(result).rejects.toMatchObject({ code: 'forbidden' });
});
it('records the change in the technical audit log', async () => {
    const doubles = InternetAccessDoubles.setup();
    const trail = new MemoryAuditTrail();
    const subject = subjectFor(doubles, trail);

    await subject.execute(admin, { domain: 'home.example.fr' });

    expect(trail.entries.map((entry) => [entry.category, entry.outcome])).toEqual([
        ['server-settings.domain-name-changed', 'successful'],
    ]);
});
it('gets a certificate for the new name while HTTPS is on', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    await subject.execute(admin, { domain: 'home.example.fr' });
    await doubles.background.settled();

    expect([doubles.store.current.certificate?.address, doubles.authority.subjects]).toEqual([
        'home.example.fr',
        [{ kind: 'domain', name: 'home.example.fr' }],
    ]);
});
it('goes back to an address certificate when the name is removed while HTTPS is on', async () => {
    const doubles = InternetAccessDoubles.setup(
        InternetAccessDoubles.active({ domain: 'home.example.fr', certificate: domainCertificate }),
    );
    const subject = subjectFor(doubles);

    doubles.names.name = 'home.example.fr';

    await subject.execute(admin, { domain: null });
    await doubles.background.settled();

    expect(doubles.store.current.certificate?.address).toBe(publicAddress);
});
it('keeps the current certificate when the new one cannot be issued', async () => {
    const doubles = InternetAccessDoubles.setup(InternetAccessDoubles.active());
    const subject = subjectFor(doubles);

    doubles.authority.refusal = 'rate-limited';

    await subject.execute(admin, { domain: 'home.example.fr' });
    await doubles.background.settled();

    expect([
        doubles.store.current.phase,
        doubles.store.current.certificate?.address,
        doubles.store.current.failure?.reason,
    ]).toEqual(['active', publicAddress, 'rate-limited']);
});
it('gets no certificate while HTTPS is off', async () => {
    const doubles = InternetAccessDoubles.setup();
    const subject = subjectFor(doubles);

    await subject.execute(admin, { domain: 'home.example.fr' });
    await doubles.background.settled();

    expect(doubles.authority.requested).toEqual([]);
});
