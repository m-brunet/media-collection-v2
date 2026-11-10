import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type IconSetName =
    | 'lucide'
    | 'solid-silhouettes'
    | 'hand-inked-editorial'
    | 'architectural-wireframes'
    | 'single-ink-risograph'
    | 'quiet-editorial-monoline';

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
