import { ApiError } from './api.util';
import type { MessageKey } from './i18n/catalog-en';

// Turns a failed request into translated interface text: a screen-specific message first, then
// the server's precise reason, then a general message for the kind of failure.
export class ApiErrorMessage {
    private static readonly reasons: Record<string, MessageKey> = {
        'username-taken': 'reason.usernameTaken',
        'username-format': 'reason.usernameFormat',
        'password-length': 'reason.passwordLength',
        'password-incorrect': 'reason.passwordIncorrect',
        'password-unchanged': 'reason.passwordUnchanged',
        'credentials-incorrect': 'reason.credentialsIncorrect',
        'protected-administrator': 'reason.protectedAdministrator',
        'admin-only': 'reason.adminOnly',
        'guest-read-only': 'reason.guestReadOnly',
        'temporary-password': 'reason.temporaryPassword',
        'setup-completed': 'reason.setupCompleted',
        'setup-desktop-only': 'reason.setupDesktopOnly',
        'account-missing': 'reason.accountMissing',
        'already-active': 'reason.alreadyActive',
        'already-inactive': 'reason.alreadyInactive',
        'account-changed': 'reason.accountChanged',
        'role-required': 'reason.roleRequired',
        'ports-identical': 'reason.portsIdentical',
        'certificate-incomplete': 'reason.certificateIncomplete',
        'session-ended': 'errors.unauthorized',
    };

    static key(
        error: unknown,
        specific: Partial<Record<number | string, MessageKey>> = {},
    ): MessageKey {
        if (!(error instanceof ApiError)) {
            return error instanceof TypeError ? 'errors.network' : 'errors.generic';
        }

        const precise =
            (error.reason ? specific[error.reason] : undefined) ??
            (error.code ? specific[error.code] : undefined) ??
            specific[error.status] ??
            (error.reason ? ApiErrorMessage.reasons[error.reason] : undefined);

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
