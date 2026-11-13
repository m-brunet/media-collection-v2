import { Failure } from '../../../shared/domain/exceptions/failure.js';
import { Required } from '../../../shared/domain/required.helper.js';

export class DomainName {
    private static readonly longest = 253;
    private static readonly label = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

    private constructor(readonly value: string) {
        Object.freeze(this);
    }

    static optional(value: string | null): DomainName | null {
        const trimmed = (value ?? '').trim().toLowerCase();

        if (!trimmed) {
            return null;
        }

        const name = trimmed.endsWith('.') ? trimmed.slice(0, -1) : trimmed;

        Failure.ensure(
            DomainName.valid(name),
            'Enter a domain name such as home.example.com, without https:// or a port.',
            'domain-name-invalid',
        );

        return new DomainName(name);
    }

    private static valid(name: string): boolean {
        const labels = name.split('.');

        return (
            name.length <= DomainName.longest &&
            labels.length >= 2 &&
            labels.every((label) => DomainName.label.test(label)) &&
            !/^\d+$/.test(Required.at(labels, labels.length - 1, 'a domain name has a last label'))
        );
    }
}
