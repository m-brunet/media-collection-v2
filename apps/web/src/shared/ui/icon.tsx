import type { LucideIcon } from 'lucide-react';
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

// Semantic icon names used by the interface. The Lucide mapping is the default icon set;
// alternative installation-wide sets plug in here later (Task 10).
const lucide = {
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
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof lucide;

// Decorative by default; pass `label` when the icon alone carries meaning.
export function Icon({
    name,
    size = 18,
    label,
    className,
}: {
    name: IconName;
    size?: number;
    label?: string;
    className?: string;
}) {
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
