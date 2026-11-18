import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type BookcaseSizeName = 'large' | 'small';

export class BookcaseSize {
    static readonly names: readonly BookcaseSizeName[] = ['large', 'small'];
    static readonly initial: BookcaseSizeName = 'large';

    static of(value: string): BookcaseSizeName {
        const size = BookcaseSize.names.find((name) => name === value);

        Failure.ensure(size, 'Choose a Large or Small bookcase.', 'bookcase-size-invalid');

        return size;
    }
}
