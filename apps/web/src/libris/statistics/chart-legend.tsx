import type { ChartSegment } from './chart-segment';

export function ChartLegend({
    label,
    segments,
    inline = false,
}: {
    label: string;
    segments: readonly ChartSegment[];
    inline?: boolean;
}) {
    return (
        <ul
            className={
                inline ? 'statistics-legends statistics-legends--inline' : 'statistics-legends'
            }
            aria-label={label}
        >
            {segments.map((segment) => (
                <li
                    key={segment.key}
                    className={
                        segment.dimmed
                            ? 'statistics-legend statistics-legend--dimmed'
                            : 'statistics-legend'
                    }
                >
                    <span
                        className="statistics-legend__swatch"
                        style={{ background: segment.color }}
                    />
                    <span>{segment.label}</span>
                    <b>{segment.detail}</b>
                </li>
            ))}
        </ul>
    );
}
