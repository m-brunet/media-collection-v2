import { expect, it } from 'vitest';
import { ConnectionClass } from './connection-class.value-object.js';

it('treats a provider address as public and reachable', () => {
    const address = '82.66.118.204';

    const connection = ConnectionClass.of(address);

    expect([connection.kind, connection.reachable]).toEqual(['public', true]);
});
it('recognises the first CGNAT address', () => {
    const address = '100.64.0.1';

    const connection = ConnectionClass.of(address);

    expect([connection.kind, connection.reachable]).toEqual(['cgnat', false]);
});
it('recognises the last CGNAT address', () => {
    const address = '100.127.255.254';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('cgnat');
});
it('keeps the address just below the CGNAT range public', () => {
    const address = '100.63.255.255';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('public');
});
it('keeps the address just above the CGNAT range public', () => {
    const address = '100.128.0.1';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('public');
});
it('treats a home network address as a router behind another router', () => {
    const address = '192.168.1.254';

    const connection = ConnectionClass.of(address);

    expect([connection.kind, connection.reachable]).toEqual(['private', false]);
});
it('treats a 10.x address as private', () => {
    const address = '10.0.0.1';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('private');
});
it('treats the first 172.16/12 address as private', () => {
    const address = '172.16.0.1';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('private');
});
it('treats the last 172.16/12 address as private', () => {
    const address = '172.31.255.255';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('private');
});
it('keeps the address just above 172.16/12 public', () => {
    const address = '172.32.0.1';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('public');
});
it('treats a link-local address as private', () => {
    const address = '169.254.10.1';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('private');
});
it('treats the unspecified address as private', () => {
    const address = '0.0.0.0';

    const connection = ConnectionClass.of(address);

    expect(connection.kind).toBe('private');
});
it('trims the reported address', () => {
    const address = ' 82.66.118.204 ';

    const connection = ConnectionClass.of(address);

    expect(connection.address).toBe('82.66.118.204');
});
it('rejects an address with three parts', () => {
    const address = '82.66.118';

    const operation = () => ConnectionClass.of(address);

    expect(operation).toThrow('IPv4');
});
it('rejects a part above 255', () => {
    const address = '82.66.118.256';

    const operation = () => ConnectionClass.of(address);

    expect(operation).toThrow('IPv4');
});
it('rejects an IPv6 address', () => {
    const address = '2001:db8::1';

    const operation = () => ConnectionClass.of(address);

    expect(operation).toThrow('IPv4');
});
