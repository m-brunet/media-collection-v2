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
    BookCheck,
    BookCopy,
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
    CameraOff,
    CircleAlert,
    CircleCheck,
    History,
    Info,
    LayoutDashboard,
    Layers,
    Palette,
    LoaderCircle,
    LogOut,
    ScanBarcode,
    Server,
    Settings2,
    ShieldAlert,
    ShieldCheck,
    UserRound,
    Users,
    WifiOff,
    X,
} from 'lucide-react';

const lucide = {
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
    'permission-denied': ShieldAlert,
    'already-owned': BookCheck,
    'existing-edition': BookCopy,
    'camera-unavailable': CameraOff,
    'lookup-offline': WifiOff,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof lucide;

const purposes: Partial<Record<IconName, string>> = {
    overview: 'overview',
    activity: 'activity',
    administration: 'administration',
    settings: 'settings',
    accounts: 'administration',
    server: 'settings',
    'permission-denied': 'permission-denied',
    'already-owned': 'already-owned',
    'existing-edition': 'existing-edition',
    'camera-unavailable': 'camera-unavailable',
    'lookup-offline': 'lookup-offline',
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

function useArtwork(set: IconSetName): Map<string, string> | null {
    const [, setLoaded] = useState<IconSetName | null>(null);
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
