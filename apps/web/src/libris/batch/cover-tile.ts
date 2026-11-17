export interface CoverTile {
    chosen: boolean;
    check?: boolean;
    pressed?: boolean;
    disabled?: boolean;
    dimmed?: boolean;
    sub?: string;
    badge?: { label: string; tone: 'accent' | 'muted' | 'warning' };
}
