export class TestIds {
    private static counter = 0;

    static next(): string {
        TestIds.counter += 1;

        return '00000000-0000-4000-8000-' + TestIds.counter.toString(16).padStart(12, '0');
    }

    static sequence(): number {
        TestIds.counter += 1;

        return TestIds.counter;
    }
}
