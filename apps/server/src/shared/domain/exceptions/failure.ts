export type FailureCode = 'invalid_input' | 'not_found' | 'conflict' | 'unauthorized' | 'forbidden';

export class Failure extends Error {
    constructor(
        public readonly code: FailureCode,
        message: string,
    ) {
        super(message);
        this.name = 'Failure';
    }

    static ensure(condition: unknown, message: string): asserts condition {
        if (!condition) {
            throw new Failure('invalid_input', message);
        }
    }
}
