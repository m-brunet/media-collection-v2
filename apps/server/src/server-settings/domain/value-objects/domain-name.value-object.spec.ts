import { expect, it } from 'vitest';
import { DomainName } from './domain-name.value-object.js';

it('accepts a domain name', () => {
    const input = 'home.example.fr';

    const name = DomainName.optional(input);

    expect(name?.value).toBe('home.example.fr');
});
it('writes the name in lower case without spaces', () => {
    const input = '  Home.Example.FR ';

    const name = DomainName.optional(input);

    expect(name?.value).toBe('home.example.fr');
});
it('drops the final dot of a fully qualified name', () => {
    const input = 'home.example.fr.';

    const name = DomainName.optional(input);

    expect(name?.value).toBe('home.example.fr');
});
it('accepts hyphens and punycode labels', () => {
    const input = 'ma-maison.xn--bibliothque-bbb.fr';

    const name = DomainName.optional(input);

    expect(name?.value).toBe('ma-maison.xn--bibliothque-bbb.fr');
});
it('means no domain name when blank', () => {
    const input = '   ';

    const name = DomainName.optional(input);

    expect(name).toBeNull();
});
it('means no domain name when missing', () => {
    const input = null;

    const name = DomainName.optional(input);

    expect(name).toBeNull();
});
it('refuses an address with a scheme', () => {
    const input = 'https://home.example.fr';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a port', () => {
    const input = 'home.example.fr:3443';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a name without a dot', () => {
    const input = 'localhost';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses an IP address', () => {
    const input = '82.66.118.204';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a wildcard', () => {
    const input = '*.example.fr';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a label starting with a hyphen', () => {
    const input = '-home.example.fr';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a label longer than 63 characters', () => {
    const input = 'a'.repeat(64) + '.example.fr';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
it('refuses a name longer than 253 characters', () => {
    const input = Array.from({ length: 5 }, () => 'a'.repeat(60)).join('.') + '.fr';

    const operation = () => DomainName.optional(input);

    expect(operation).toThrow(expect.objectContaining({ reason: 'domain-name-invalid' }));
});
