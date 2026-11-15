import type { ChartSegment } from './chart-segment';
import { ChartLegend } from './chart-legend';

export function SplitBar({
    label,
    segments,
}: {
    label: string;
    segments: readonly ChartSegment[];
}) {
    return (
        <div className="statistics-split">
            <div className="statistics-split__bar" aria-hidden="true">
                {segments.map(
                    (segment) =>
                        segment.value > 0 && (
                            <span
                                key={segment.key}
                                className={
                                    segment.dimmed
                                        ? 'statistics-split__part statistics-split__part--dimmed'
                                        : 'statistics-split__part'
                                }
                                style={{ flexGrow: segment.value, background: segment.color }}
                            />
                        ),
                )}
            </div>
            <ChartLegend label={label} segments={segments} inline />
        </div>
    );
}
