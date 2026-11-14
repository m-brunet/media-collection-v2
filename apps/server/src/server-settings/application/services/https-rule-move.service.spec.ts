import { expect, it } from 'vitest';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { InternetAccessDoubles } from '../testing/internet-access-doubles.test-support.js';
import { HttpsRuleMove } from './https-rule-move.service.js';

function subjectFor(doubles: ReturnType<typeof InternetAccessDoubles.setup>) {
    return new HttpsRuleMove(doubles.rules, doubles.log);
}

it('needs a move when the HTTPS port differs from the router port', () => {
    const subject = subjectFor(InternetAccessDoubles.setup());
    const access = new InternetAccess(InternetAccessDoubles.active({ routerPort: 443 }));

    const needed = subject.needed(access, 34443);

    expect(needed).toBe(true);
});
it('needs no move when the router port is the HTTPS port', () => {
    const subject = subjectFor(InternetAccessDoubles.setup());
    const access = new InternetAccess(InternetAccessDoubles.active({ routerPort: 34443 }));

    const needed = subject.needed(access, 34443);

    expect(needed).toBe(false);
});
it('needs no move while internet access is off', () => {
    const subject = subjectFor(InternetAccessDoubles.setup());

    const needed = subject.needed(InternetAccess.off(), 34443);

    expect(needed).toBe(false);
});
it('removes the former router rule and records the new port', async () => {
    const doubles = InternetAccessDoubles.setup();
    const access = new InternetAccess(InternetAccessDoubles.active({ routerPort: 443 }));

    await subjectFor(doubles).to(access, 34443);

    expect([doubles.router.closed, access.routerPort, access.snapshot.addressMoved]).toEqual([
        [{ externalPort: 443, internalPort: 443 }],
        34443,
        true,
    ]);
});
it('logs the move', async () => {
    const doubles = InternetAccessDoubles.setup();
    const access = new InternetAccess(InternetAccessDoubles.active({ routerPort: 443 }));

    await subjectFor(doubles).to(access, 34443);

    expect(doubles.log.lines).toEqual([
        'Internet access: HTTPS router rule moved from port 443 to port 34443',
    ]);
});
it('leaves a router rule added by hand to the Admin', async () => {
    const doubles = InternetAccessDoubles.setup();
    const access = new InternetAccess(
        InternetAccessDoubles.active({ routerPort: 443, mapping: 'manual' }),
    );

    await subjectFor(doubles).to(access, 34443);

    expect([doubles.router.closed, access.routerPort]).toEqual([[], 34443]);
});
