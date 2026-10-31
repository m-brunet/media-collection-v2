import { expect, it } from 'vitest';
import { HttpSettings } from './http-settings.value-object.js';

it('accepts the inclusive minimum HTTP port', () => {
    const settings = { port: 1024 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).not.toThrow();
});

it('accepts a chosen web listening port', () => {
    const settings = { port: 36000 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).not.toThrow();
});

it('accepts the inclusive maximum HTTP port', () => {
    const settings = { port: 65535 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).not.toThrow();
});

it('rejects an HTTP port below the minimum', () => {
    const settings = { port: 1023 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).toThrow('1024');
});

it('rejects an HTTP port above the maximum', () => {
    const settings = { port: 65536 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).toThrow('65535');
});

it('rejects ephemeral HTTP port zero', () => {
    const settings = { port: 0 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).toThrow('1024');
});

it('rejects a negative HTTP port', () => {
    const settings = { port: -1 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).toThrow();
});

it('rejects a fractional HTTP port', () => {
    const settings = { port: 36000.5 };

    const operation = () => new HttpSettings(settings.port);

    expect(operation).toThrow('integer');
});
