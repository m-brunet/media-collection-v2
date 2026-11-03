import type { LucideIcon } from 'lucide-react';
import {
    ArrowLeft,
    CircleAlert,
    CircleCheck,
    Info,
    Layers,
    Library,
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
    account: UserRound,
    administration: ShieldCheck,
    accounts: Users,
    server: Server,
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
