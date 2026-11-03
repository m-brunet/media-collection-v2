import { ApiError } from './api.util';
import type { MessageKey } from './i18n/catalog-en';

// Turns a failed request into translated interface text. Screens may supply more precise
// messages for statuses they understand (for example an incorrect sign-in).
export class ApiErrorMessage {
    static key(
        error: unknown,
        specific: Partial<Record<number | string, MessageKey>> = {},
    ): MessageKey {
        if (!(error instanceof ApiError)) {
            return error instanceof TypeError ? 'errors.network' : 'errors.generic';
        }

        const precise = (error.code ? specific[error.code] : undefined) ?? specific[error.status];

        if (precise) {
            return precise;
        }

        switch (error.status) {
            case 400:
                return 'errors.invalid';
            case 401:
                return 'errors.unauthorized';
            case 403:
                return 'errors.forbidden';
            case 409:
                return 'errors.conflict';
            case 429:
                return 'errors.tooManyAttempts';
            default:
                return 'errors.generic';
        }
    }
}
