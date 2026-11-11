import type { IconSetName } from '../../../../../packages/contracts/src/http';

export class IconSetMemory {
    static readonly names: readonly IconSetName[] = [
        'lucide',
        'solid-silhouettes',
        'hand-inked-editorial',
        'architectural-wireframes',
        'single-ink-risograph',
        'quiet-editorial-monoline',
    ];
    private static readonly key = 'media-collection.icon-set';

    static read(): IconSetName {
        let stored: string | null = null;

        try {
            stored = window.localStorage.getItem(IconSetMemory.key);
        } catch {
            stored = null;
        }

        return stored && (IconSetMemory.names as readonly string[]).includes(stored)
            ? (stored as IconSetName)
            : 'lucide';
    }

    static write(name: IconSetName): void {
        try {
            window.localStorage.setItem(IconSetMemory.key, name);
        } catch {}
    }
}
