import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigurationFile } from './configuration-file.adapter.js';

let directory: string;
let path: string;

beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'configuration-file-'));
    path = join(directory, 'config.json');
});
afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
});

it('reads nothing from a missing file', () => {
    const file = new ConfigurationFile(path);

    const result = file.read();

    expect(result).toEqual({});
});
it('reads nothing from an empty object', () => {
    writeFileSync(path, '{}');
    const file = new ConfigurationFile(path);

    const result = file.read();

    expect(result).toEqual({});
});
it('reads the host, the HTTP port and an absolute data folder', () => {
    const data = join(directory, 'library');

    writeFileSync(path, JSON.stringify({ host: '127.0.0.1', httpPort: 4000, dataDirectory: data }));
    const file = new ConfigurationFile(path);

    const result = file.read();

    expect(result).toEqual({ host: '127.0.0.1', httpPort: 4000, dataDirectory: data });
});
it('resolves a relative data folder from the folder of the file', () => {
    writeFileSync(path, JSON.stringify({ dataDirectory: 'library' }));
    const file = new ConfigurationFile(path);

    const result = file.read();

    expect(result).toEqual({ dataDirectory: join(directory, 'library') });
});
it('accepts a file saved with a byte order mark', () => {
    writeFileSync(path, '﻿{ "httpPort": 4000 }');
    const file = new ConfigurationFile(path);

    const result = file.read();

    expect(result).toEqual({ httpPort: 4000 });
});
it('rejects a file that is not JSON, naming the file', () => {
    writeFileSync(path, '{ httpPort: 4000 }');
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ' is not valid JSON');
});
it('rejects a file that is not a JSON object', () => {
    writeFileSync(path, '[4000]');
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': must contain a JSON object.');
});
it('rejects an unknown setting', () => {
    writeFileSync(path, JSON.stringify({ httpport: 4000 }));
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': unknown setting "httpport".');
});
it('rejects an HTTP port below 1024', () => {
    writeFileSync(path, JSON.stringify({ httpPort: 80 }));
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': httpPort must be a whole number between 1024 and 65535.');
});
it('rejects an HTTP port written as text', () => {
    writeFileSync(path, JSON.stringify({ httpPort: '4000' }));
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': httpPort must be a whole number between 1024 and 65535.');
});
it('rejects an HTTP port set to null', () => {
    writeFileSync(path, JSON.stringify({ httpPort: null }));
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': httpPort must be a whole number between 1024 and 65535.');
});
it('rejects an empty host', () => {
    writeFileSync(path, JSON.stringify({ host: ' ' }));
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': host must be a non-empty address.');
});
it('rejects an empty data folder', () => {
    writeFileSync(path, JSON.stringify({ dataDirectory: '' }));
    const file = new ConfigurationFile(path);

    const operation = () => file.read();

    expect(operation).toThrow(path + ': dataDirectory must be a non-empty folder path.');
});
it('creates a missing file as an empty object, with its folder', () => {
    const nested = join(directory, 'Media Collection', 'config.json');
    const file = new ConfigurationFile(nested);

    file.ensure();

    expect(readFileSync(nested, 'utf8')).toBe('{}\n');
});
it('keeps an existing file when asked to create it', () => {
    writeFileSync(path, '{ "httpPort": 4000 }');
    const file = new ConfigurationFile(path);

    file.ensure();

    expect(readFileSync(path, 'utf8')).toBe('{ "httpPort": 4000 }');
});
