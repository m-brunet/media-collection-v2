import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { IconSetName } from '../../../../../packages/contracts/src/http';
import { useIconSet } from '../appearance/appearance-context';
import { IconArtwork } from './icon-artwork.util';
import {
    ArrowLeft,
    ArrowRightLeft,
    Inbox,
    LibraryBig,
    SlidersHorizontal,
    Tag,
    BookOpen,
    BookPlus,
    BookDown,
    BookUp,
    Check,
    ChevronDown,
    ChevronRight,
    ImageOff,
    ImagePlus,
    Pencil,
    Plus,
    QrCode,
    Search,
    Trash2,
    CircleAlert,
    CircleCheck,
    History,
    Info,
    LayoutDashboard,
    Layers,
    Library,
    Palette,
    LoaderCircle,
    LogOut,
    ScanBarcode,
    Server,
    Settings2,
    ShieldCheck,
    UserRound,
    Users,
    X,
} from 'lucide-react';

// Semantic icon names used by the interface. The Lucide mapping is the default icon set; the
// installation-wide icon set (KI-6) replaces the names listed in `purposes` below.
const lucide = {
    // Leaf's mark; Libris shows its own official icon (see Brand).
    brand: Library,
    overview: LayoutDashboard,
    activity: History,
    account: UserRound,
    administration: ShieldCheck,
    accounts: Users,
    server: Server,
    appearance: Palette,
    settings: Settings2,
    'sign-out': LogOut,
    success: CircleCheck,
    error: CircleAlert,
    info: Info,
    loading: LoaderCircle,
    close: X,
    back: ArrowLeft,
    collections: Layers,
    scan: ScanBarcode,
    books: BookOpen,
    'book-add': BookPlus,
    add: Plus,
    edit: Pencil,
    delete: Trash2,
    search: Search,
    check: Check,
    expand: ChevronRight,
    collapse: ChevronDown,
    'cover-missing': ImageOff,
    'cover-add': ImagePlus,
    bookshelves: LibraryBig,
    tag: Tag,
    inbox: Inbox,
    filter: SlidersHorizontal,
    move: ArrowRightLeft,
    lend: BookUp,
    'lend-return': BookDown,
    qr: QrCode,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof lucide;

// The icon set purposes (artwork file names) the interface uses. Names without a purpose, such as
// close, chevrons, check, add, edit and delete, stay Lucide in every set (design guidelines).
const purposes: Partial<Record<IconName, string>> = {
    overview: 'overview',
    activity: 'activity',
    administration: 'administration',
    settings: 'settings',
    // Admin links (decided 2026-11-09): Accounts shows the sets' Administration artwork and
    // Server settings their Settings artwork. Appearance stays Lucide until it has its own
    // artwork; with Lucide chosen, every link keeps its own Lucide icon.
    accounts: 'administration',
    server: 'settings',
    success: 'success',
    error: 'error',
    loading: 'loading',
    collections: 'collections',
    scan: 'scan-barcode',
    books: 'my-books',
    'book-add': 'add-book',
    search: 'search',
    'cover-missing': 'missing-cover',
    bookshelves: 'shelves',
    tag: 'tags',
    inbox: 'empty-state',
    lend: 'lending',
    'lend-return': 'record-return',
};

// The chosen set's artwork, loaded once per set; null while loading or for Lucide.
function useArtwork(set: IconSetName): Map<string, string> | null {
    // Only re-renders this icon once the set has loaded; the artwork itself comes from the cache.
    const [, setLoaded] = useState<IconSetName | null>(null);
    // A failed load keeps Lucide and tries again a few seconds later, at most a few times.
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        if (set === 'lucide' || IconArtwork.ready(set)) {
            return;
        }

        let current = true;
        let retry: ReturnType<typeof setTimeout> | undefined;

        IconArtwork.load(set).then(
            () => {
                if (current) {
                    setLoaded(set);
                }
            },
            () => {
                if (current && attempt < 3) {
                    retry = setTimeout(() => setAttempt(attempt + 1), 5000);
                }
            },
        );

        return () => {
            current = false;
            clearTimeout(retry);
        };
    }, [set, attempt]);

    return set === 'lucide' ? null : IconArtwork.ready(set);
}

// Decorative by default; pass `label` when the icon alone carries meaning. Draws the
// installation's icon set (KI-6), falling back to Lucide for the other names and while the set
// loads.
export function Icon({
    name,
    size = 18,
    label,
    className,
    set: shown,
}: {
    name: IconName;
    size?: number;
    label?: string;
    className?: string;
    // A specific set instead of the installation's, for example to preview a choice.
    set?: IconSetName;
}) {
    const chosen = useIconSet();
    const set = shown ?? chosen;
    const artwork = useArtwork(set);
    const purpose = purposes[name];
    const svg = purpose ? artwork?.get(purpose) : undefined;

    if (svg) {
        return (
            <span
                className={['icon-art', className].filter(Boolean).join(' ')}
                data-icon-set={set}
                style={{ width: size, height: size }}
                aria-hidden={label ? undefined : true}
                aria-label={label}
                role={label ? 'img' : undefined}
                // Trusted artwork shipped with the app (tools/import-icon-sets.mjs), never user data.
                dangerouslySetInnerHTML={{ __html: svg }}
            />
        );
    }

    const Component = lucide[name];

    return (
        <Component
            size={size}
            strokeWidth={1.75}
            className={className}
            aria-hidden={label ? undefined : true}
            aria-label={label}
            role={label ? 'img' : undefined}
            focusable="false"
        />
    );
}
