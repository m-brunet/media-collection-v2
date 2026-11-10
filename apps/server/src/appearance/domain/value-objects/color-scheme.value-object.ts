import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type ColorSchemeName =
    | 'spring-green'
    | 'midnight-blue'
    | 'velvet-violet'
    | 'ember'
    | 'rose-noir'
    | 'graphite-gold'
    | 'slate-orchid'
    | 'charcoal-scarlet';

export class ColorScheme {
    static readonly names: readonly ColorSchemeName[] = [
        'spring-green',
        'midnight-blue',
        'velvet-violet',
        'ember',
        'rose-noir',
        'graphite-gold',
        'slate-orchid',
        'charcoal-scarlet',
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
