import { expect, it } from 'vitest';
import { resolve } from 'node:path';
import { DesktopConfigurationParser } from './configuration.util.js';

it('defaults to remotely accessible HTTP', () => {
    const args: string[] = [];
    const environment = {};

    const result = DesktopConfigurationParser.parse(args, environment, 'data');

    expect(result).toEqual({
        host: '0.0.0.0',
        httpPort: undefined,
        httpPortSource: undefined,
        dataDirectory: resolve('data'),
        dataDirectoryOverridden: false,
        localMaintenance: false,
        maintenance: null,
    });
});
it('reports a data directory chosen through the environment', () => {
    const environment = { APP_DATA_DIR: 'elsewhere' };

    const result = DesktopConfigurationParser.parse([], environment, 'data');

    expect(result).toMatchObject({
        dataDirectory: resolve('elsewhere'),
        dataDirectoryOverridden: true,
    });
});
it('selects the development data reset', () => {
    const args = ['--dev-reset-data'];

    const result = DesktopConfigurationParser.parse(args, {}, 'data');

    expect(result.maintenance).toEqual({ type: 'reset' });
});
it('selects the V1 import with its resolved source file', () => {
    const args = ['--dev-import-v1', 'local-imports/v1/books.json'];

    const result = DesktopConfigurationParser.parse(args, {}, 'data');

    expect(result.maintenance).toEqual({
        type: 'import-v1',
        source: resolve('local-imports/v1/books.json'),
    });
});
it('requires the source file of the V1 import', () => {
    const args = ['--dev-import-v1'];

    const operation = () => DesktopConfigurationParser.parse(args, {}, 'data');

    expect(operation).toThrow('value');
});
it('refuses both development data commands at once', () => {
    const args = ['--dev-reset-data', '--dev-import-v1', 'books.json'];

    const operation = () => DesktopConfigurationParser.parse(args, {}, 'data');

    expect(operation).toThrow('either');
});
it('refuses a development data command combined with local maintenance', () => {
    const args = ['--maintenance', '--dev-reset-data'];

    const operation = () => DesktopConfigurationParser.parse(args, {}, 'data');

    expect(operation).toThrow('separately');
});
it('gives CLI settings precedence over environment', () => {
    const args = ['--http-port', '1024', '--host', '127.0.0.1', '--data-dir', 'custom'];
    const environment = { APP_HTTP_PORT: '4000' };

    const result = DesktopConfigurationParser.parse(args, environment, 'data');

    expect(result).toMatchObject({
        httpPort: 1024,
        httpPortSource: 'command-line',
        host: '127.0.0.1',
        dataDirectory: resolve('custom'),
    });
});
it('selects the local maintenance window', () => {
    const args = ['--maintenance'];

    const result = DesktopConfigurationParser.parse(args, {}, 'data');

    expect(result.localMaintenance).toBe(true);
});
it('starts the application without the maintenance option', () => {
    const args: string[] = [];

    const result = DesktopConfigurationParser.parse(args, {}, 'data');

    expect(result.localMaintenance).toBe(false);
});
it('requires a value after the data directory option', () => {
    const args = ['--data-dir'];
    const environment = {};
    const message = 'value';
    const input = args;

    const operation = () => DesktopConfigurationParser.parse(input, environment, 'data');

    expect(operation).toThrow(message);
});
it('rejects a nonnumeric HTTP port', () => {
    const args: string[] = [];
    const environment = { APP_HTTP_PORT: 'invalid' };
    const message = 'port';
    const input = args;

    const operation = () => DesktopConfigurationParser.parse(input, environment, 'data');

    expect(operation).toThrow(message);
});
it('uses an environment HTTP port when no CLI override is supplied', () => {
    const environment = { APP_HTTP_PORT: '36000' };

    const result = DesktopConfigurationParser.parse([], environment, 'data');

    expect(result).toMatchObject({ httpPort: 36000, httpPortSource: 'environment' });
});
it('accepts the inclusive maximum CLI port', () => {
    const args = ['--http-port', '65535'];

    const result = DesktopConfigurationParser.parse(args, {}, 'data');

    expect(result).toMatchObject({ httpPort: 65535, httpPortSource: 'command-line' });
});
it('rejects CLI port zero', () => {
    const args = ['--http-port', '0'];

    const operation = () => DesktopConfigurationParser.parse(args, {}, 'data');

    expect(operation).toThrow('1024');
});
it('rejects a privileged CLI port', () => {
    const args = ['--http-port', '1023'];

    const operation = () => DesktopConfigurationParser.parse(args, {}, 'data');

    expect(operation).toThrow('1024');
});
it('rejects an environment port above the maximum', () => {
    const environment = { APP_HTTP_PORT: '65536' };

    const operation = () => DesktopConfigurationParser.parse([], environment, 'data');

    expect(operation).toThrow('65535');
});
it('rejects a fractional environment port', () => {
    const environment = { APP_HTTP_PORT: '36000.5' };

    const operation = () => DesktopConfigurationParser.parse([], environment, 'data');

    expect(operation).toThrow('integer');
});
it('rejects a blank environment port', () => {
    const environment = { APP_HTTP_PORT: '' };

    const operation = () => DesktopConfigurationParser.parse([], environment, 'data');

    expect(operation).toThrow('1024');
});
