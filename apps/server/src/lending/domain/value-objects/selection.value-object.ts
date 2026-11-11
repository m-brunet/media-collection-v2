import { Failure } from '../../../shared/domain/exceptions/failure.js';

export class Selection {
    private constructor(readonly ids: readonly string[]) {}

    static of(ids: readonly string[]): Selection {
        Failure.ensure(ids.length > 0, 'Select at least one book.', 'selection-empty');
        Failure.ensure(
            new Set(ids).size === ids.length,
            'Each book can be selected only once.',
            'selection-duplicate',
        );

        return new Selection([...ids]);
    }
}
