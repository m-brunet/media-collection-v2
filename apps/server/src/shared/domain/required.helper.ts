export class Required {
    static value<T>(value: T | null | undefined, reason: string): T {
        if (value === null || value === undefined) {
            throw new Error(reason);
        }

        return value;
    }

    static at<T>(items: readonly T[], index: number, reason: string): T {
        return Required.value(items[index], reason);
    }
}
