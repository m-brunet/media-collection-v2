import { expect, it } from 'vitest';
import { ServerAddress } from './server-address.util';

it('gives the Leaf address of a server address', () => {
    const leaf = ServerAddress.leaf('http://192.168.1.99:34345');

    expect(leaf).toBe('http://192.168.1.99:34345/leaf/');
});
it('recognises an IPv4 loopback address', () => {
    const loopback = ServerAddress.loopback('http://127.0.0.1:34345');

    expect(loopback).toBe(true);
});
it('recognises localhost', () => {
    const loopback = ServerAddress.loopback('http://localhost:34345');

    expect(loopback).toBe(true);
});
it('recognises the IPv6 loopback address', () => {
    const loopback = ServerAddress.loopback('http://[::1]:34345');

    expect(loopback).toBe(true);
});
it('keeps a home network address', () => {
    const loopback = ServerAddress.loopback('http://192.168.1.99:34345');

    expect(loopback).toBe(false);
});
it('keeps a Tailscale address', () => {
    const loopback = ServerAddress.loopback('http://100.95.86.107:34345');

    expect(loopback).toBe(false);
});
