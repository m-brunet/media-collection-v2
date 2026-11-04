import { expect, it } from 'vitest';
import { LocalRequest } from './local-request.helper.js';

it('accepts the IPv4 loopback address', () => {
    const address = '127.0.0.1';

    const result = LocalRequest.isLocal(address);

    expect(result).toBe(true);
});

it('accepts the IPv6 loopback address', () => {
    const address = '::1';

    const result = LocalRequest.isLocal(address);

    expect(result).toBe(true);
});

it('accepts IPv4 loopback seen through an IPv6 listener', () => {
    const address = '::ffff:127.0.0.1';

    const result = LocalRequest.isLocal(address);

    expect(result).toBe(true);
});

it('rejects a device on the home network', () => {
    const address = '192.168.1.20';

    const result = LocalRequest.isLocal(address);

    expect(result).toBe(false);
});

it('rejects an unknown address', () => {
    const address = undefined;

    const result = LocalRequest.isLocal(address);

    expect(result).toBe(false);
});
