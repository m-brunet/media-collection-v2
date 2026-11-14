export interface RankedEntry {
    name: string;
    value: number;
    display: string;
}

export function BarRanking({ label, entries }: { label: string; entries: readonly RankedEntry[] }) {
    const highest = Math.max(1, ...entries.map((entry) => entry.value));

    return (
        <ol className="statistics-ranking" aria-label={label}>
            {entries.map((entry, index) => (
                <li key={entry.name} className="statistics-ranking__row">
                    <span className="statistics-ranking__rank">{index + 1}</span>
                    <span className="statistics-ranking__name">{entry.name}</span>
                    <span className="statistics-ranking__bar" aria-hidden="true">
                        <span
                            className="statistics-ranking__fill"
                            style={{ width: (entry.value / highest) * 100 + '%' }}
                        />
                    </span>
                    <b className="statistics-ranking__value">{entry.display}</b>
                </li>
            ))}
        </ol>
    );
}
