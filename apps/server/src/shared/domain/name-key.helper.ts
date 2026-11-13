export class NameKey {
    static of(value: string): string {
        return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();
    }

    static similar(first: string, second: string): boolean {
        const a = NameKey.of(first);
        const b = NameKey.of(second);

        if (a === b || a.length === 0 || b.length === 0) {
            return false;
        }

        if (NameKey.containsWords(a, b) || NameKey.containsWords(b, a)) {
            return true;
        }

        const allowed = Math.max(a.length, b.length) <= 8 ? 1 : 2;

        return NameKey.distance(a, b, allowed) <= allowed;
    }

    private static containsWords(longer: string, shorter: string): boolean {
        if (shorter.length < 4 || longer.length <= shorter.length) {
            return false;
        }

        const words = (value: string) => value.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
        const outer = words(longer);
        const inner = words(shorter);

        return outer.some((_, start) =>
            inner.every((word, index) => outer[start + index] === word),
        );
    }

    private static distance(a: string, b: string, limit: number): number {
        if (Math.abs(a.length - b.length) > limit) {
            return limit + 1;
        }

        const rows: number[][] = [];

        /* oxlint-disable typescript/no-non-null-assertion -- distance matrix loop; every row and column is filled before it is read */
        for (let i = 0; i <= a.length; i++) {
            rows.push([i]);
        }

        for (let j = 1; j <= b.length; j++) {
            rows[0]![j] = j;
        }

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                let value = Math.min(
                    rows[i - 1]![j]! + 1,
                    rows[i]![j - 1]! + 1,
                    rows[i - 1]![j - 1]! + cost,
                );

                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                    value = Math.min(value, rows[i - 2]![j - 2]! + 1);
                }

                rows[i]![j] = value;
            }
        }

        return rows[a.length]![b.length]!;
        /* oxlint-enable typescript/no-non-null-assertion */
    }
}
