export type FailureCode = 'invalid_input' | 'not_found' | 'conflict' | 'unauthorized' | 'forbidden';

export class Failure extends Error {
    constructor(
        public readonly code: FailureCode,
        message: string,
        // Stable machine-readable cause (for example `username-taken`) that interfaces translate.
        public readonly reason: string | null = null,
        // Data the person needs to resolve the failure (for example similar existing names).
        public readonly details: Record<string, unknown> | null = null,
    ) {
        super(message);
        this.name = 'Failure';
    }

    static ensure(condition: unknown, message: string, reason?: string): asserts condition {
        if (!condition) {
            throw new Failure('invalid_input', message, reason ?? null);
        }
    }
}
