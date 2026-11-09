import { expect, it } from 'vitest';
import { FakeProbe, FakeRouter } from '../testing/internet-access-doubles.test-support.js';
import { RouterRules } from './router-rules.service.js';

const publicAddress = '82.66.118.204';
const rule = { externalPort: 443, internalPort: 3443 };

function rulesWith(router = new FakeRouter(), probe = new FakeProbe('82.66.1.1')) {
    return { router, probe, rules: new RouterRules(router, probe) };
}

it('finds the router', async () => {
    const { rules } = rulesWith();

    const search = await rules.find();

    expect(search).toEqual({ router: { mapping: 'upnp', externalAddress: publicAddress } });
});
it('asks the public service when no router answers', async () => {
    const { rules } = rulesWith(new FakeRouter(null));

    const search = await rules.find();

    expect(search).toEqual({ router: null, publicAddress: '82.66.1.1' });
});
it('takes the public address from the router', async () => {
    const { rules } = rulesWith();

    const address = await rules.publicAddress();

    expect(address).toBe(publicAddress);
});
it('takes the public address from the public service without a router', async () => {
    const { rules } = rulesWith(new FakeRouter(null));

    const address = await rules.publicAddress();

    expect(address).toBe('82.66.1.1');
});
it('cannot tell the public address without a router or the public service', async () => {
    const { rules } = rulesWith(new FakeRouter(null), new FakeProbe(null));

    const address = await rules.publicAddress();

    expect(address).toBeNull();
});
it('recreates a rule the application created and gives the address it serves', async () => {
    const { rules, router } = rulesWith();

    const kept = await rules.keep(rule, false);

    expect([kept, router.opened]).toEqual([{ outcome: 'serving', address: publicAddress }, [rule]]);
});
it('fails the upkeep without a router', async () => {
    const { rules } = rulesWith(new FakeRouter(null));

    const kept = await rules.keep(rule, false);

    expect(kept).toEqual({ outcome: 'failed', reason: 'no-router' });
});
it('fails the upkeep when the router refuses the rule', async () => {
    const { rules } = rulesWith(new FakeRouter(undefined, false));

    const kept = await rules.keep(rule, false);

    expect(kept).toEqual({ outcome: 'failed', reason: 'port-refused' });
});
it('fails the upkeep when the provider now shares the address', async () => {
    const { rules } = rulesWith(new FakeRouter({ mapping: 'upnp', externalAddress: '100.70.1.2' }));

    const kept = await rules.keep(rule, false);

    expect(kept).toEqual({ outcome: 'failed', reason: 'cgnat' });
});
it('follows only the public address of a rule added by hand', async () => {
    const { rules, router } = rulesWith();

    const kept = await rules.keep(rule, true);

    expect([kept, router.opened]).toEqual([{ outcome: 'serving', address: '82.66.1.1' }, []]);
});
it('fails the upkeep of a rule added by hand when the public address is unknown', async () => {
    const { rules } = rulesWith(undefined, new FakeProbe(null));

    const kept = await rules.keep(rule, true);

    expect(kept).toEqual({ outcome: 'failed', reason: 'public-address-unknown' });
});
