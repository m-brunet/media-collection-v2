import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type ColorSchemeName = 'mint' | 'emerald' | 'forest' | 'spring-green';

// The installation-wide accent colours of Libris and Leaf. Spring green is the default.
export class ColorScheme {
    static readonly names: readonly ColorSchemeName[] = [
        'mint',
        'emerald',
        'forest',
        'spring-green',
    ];
    static readonly default = new ColorScheme('spring-green');

    readonly name: ColorSchemeName;

    constructor(name: string) {
        Failure.ensure(
            (ColorScheme.names as readonly string[]).includes(name),
            'Choose one of the available colour schemes.',
            'color-scheme-unknown',
        );
        this.name = name as ColorSchemeName;
        Object.freeze(this);
    }
}
