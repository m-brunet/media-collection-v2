import type { ReactNode } from 'react';
import type { ChartSegment } from './chart-segment';
import { ChartLegend } from './chart-legend';

const radius = 42;
const circumference = 2 * Math.PI * radius;

export function RingChart({
    label,
    segments,
    note,
}: {
    label: string;
    segments: readonly ChartSegment[];
    note?: ReactNode | ReactNode[];
}) {
    const total = segments.reduce((sum, segment) => sum + segment.value, 0);
    let start = 0;

    return (
        <div className="statistics-ring">
            <svg
                className="statistics-ring__chart"
                viewBox="0 0 100 100"
                width="120"
                height="120"
                aria-hidden="true"
            >
                <circle className="statistics-ring__track" cx="50" cy="50" r={radius} />
                {total > 0 &&
                    segments.map((segment) => {
                        const length = (segment.value / total) * circumference;
                        const offset = start;

                        start += length;

                        return (
                            segment.value > 0 && (
                                <circle
                                    key={segment.key}
                                    className={
                                        segment.dimmed
                                            ? 'statistics-ring__segment statistics-ring__segment--dimmed'
                                            : 'statistics-ring__segment'
                                    }
                                    cx="50"
                                    cy="50"
                                    r={radius}
                                    stroke={segment.color}
                                    strokeDasharray={length + ' ' + circumference}
                                    strokeDashoffset={-offset}
                                />
                            )
                        );
                    })}
            </svg>
            <div className="statistics-ring__legend">
                <ChartLegend label={label} segments={segments} />
                {[note].flat().map(
                    (line, index) =>
                        line && (
                            <p key={index} className="muted">
                                {line}
                            </p>
                        ),
                )}
            </div>
        </div>
    );
}
