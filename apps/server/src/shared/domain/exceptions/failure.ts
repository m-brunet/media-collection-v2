export type FailureCode = 'invalid_input' | 'not_found' | 'conflict' | 'unauthorized' | 'forbidden';

export class Failure extends Error {
    constructor(
        public readonly code: FailureCode,
        message: string,
        public readonly reason: string | null = null,
        public readonly details: Record<string, unknown> | null = null,
    ) {
        super(message);
        this.name = 'Failure';
    }

    static auditCode(error: unknown): string {
        return error instanceof Failure
            ? error.code + (error.reason ? ':' + error.reason : '')
            : 'error';
    }

    static ensure(condition: unknown, message: string, reason?: string): asserts condition {
        if (!condition) {
            throw new Failure('invalid_input', message, reason ?? null);
        }
    }
}
