import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type IconSetName =
    | 'lucide'
    | 'solid-silhouettes'
    | 'hand-inked-editorial'
    | 'architectural-wireframes'
    | 'single-ink-risograph'
    | 'quiet-editorial-monoline';

// The installation-wide icon set of Libris and Leaf (KI-6). Lucide is the default; the five others
// are the design's icon sets 01 to 05.
export class IconSet {
    static readonly names: readonly IconSetName[] = [
        'lucide',
        'solid-silhouettes',
        'hand-inked-editorial',
        'architectural-wireframes',
        'single-ink-risograph',
        'quiet-editorial-monoline',
    ];
    static readonly default = new IconSet('lucide');

    readonly name: IconSetName;

    constructor(name: string) {
        Failure.ensure(
            (IconSet.names as readonly string[]).includes(name),
            'Choose one of the available icon sets.',
            'icon-set-unknown',
        );
        this.name = name as IconSetName;
        Object.freeze(this);
    }
}
