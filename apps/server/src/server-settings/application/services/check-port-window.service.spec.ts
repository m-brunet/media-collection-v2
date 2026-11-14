import { expect, it } from 'vitest';
import { InternetAccess } from '../../domain/entities/internet-access.entity.js';
import { InternetAccessDoubles } from '../testing/internet-access-doubles.test-support.js';

function automatic(): InternetAccess {
    return new InternetAccess(InternetAccessDoubles.active());
}

function byHand(): InternetAccess {
    return new InternetAccess(InternetAccessDoubles.active({ mapping: 'manual' }));
}

it('opens port 443 to the HTTPS port just before the check and closes it right after', async () => {
    const doubles = InternetAccessDoubles.setup();

    await doubles.window.around(automatic(), 34443, async () => {
        doubles.journal.push('check');
    });

    expect(doubles.journal).toEqual(['open 443 -> 34443', 'check', 'close 443']);
});
it('gives the result of the check', async () => {
    const doubles = InternetAccessDoubles.setup();

    const result = await doubles.window.around(automatic(), 34443, async () => 'issued');

    expect(result).toBe('issued');
});
it('closes port 443 after a check that fails', async () => {
    const doubles = InternetAccessDoubles.setup();

    const result = doubles.window.around(automatic(), 34443, async () => {
        throw new Error('Let’s Encrypt is unavailable');
    });

    await expect(result).rejects.toThrow('unavailable');
    expect(doubles.router.closed).toEqual([{ externalPort: 443, internalPort: 34443 }]);
});
it('logs the opening and the closing of port 443', async () => {
    const doubles = InternetAccessDoubles.setup();

    await doubles.window.around(automatic(), 34443, async () => undefined);

    expect(doubles.log.lines).toEqual([
        'Let’s Encrypt check: port 443 opened on the router to port 34443',
        'Let’s Encrypt check: port 443 closed on the router',
    ]);
});
it('checks anyway when the router refuses port 443, and logs it', async () => {
    const doubles = InternetAccessDoubles.setup();

    doubles.router.refusedPorts = [443];

    await doubles.window.around(automatic(), 34443, async () => {
        doubles.journal.push('check');
    });

    expect([doubles.journal, doubles.log.lines[0]]).toEqual([
        ['check', 'close 443'],
        'Let’s Encrypt check: the router refused to open port 443, checking anyway',
    ]);
});
it('leaves a router rule added by hand to the Admin', async () => {
    const doubles = InternetAccessDoubles.setup();

    await doubles.window.around(byHand(), 34443, async () => {
        doubles.journal.push('check');
    });

    expect([doubles.journal, doubles.log.lines]).toEqual([['check'], []]);
});
