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
        'setup-in-progress': 'reason.setupInProgress',
        'nothing-to-check': 'reason.nothingToCheck',
        'internet-access-on': 'reason.internetAccessOn',
        'domain-name-invalid': 'reason.domainNameInvalid',
        'https-active': 'reason.httpsActive',
        'domain-name-in-use': 'reason.domainNameInUse',
        'color-scheme-unknown': 'reason.colorSchemeUnknown',
        'title-invalid': 'reason.titleInvalid',
        'title-required': 'reason.titleRequired',
        'isbn-required': 'reason.isbnRequired',
        'isbn-invalid': 'reason.isbnInvalid',
        'isbn-taken': 'reason.isbnTaken',
        'authors-required': 'reason.authorsRequired',
        'author-name-invalid': 'reason.authorNameInvalid',
        'author-name-taken': 'reason.authorNameTaken',
        'author-missing': 'reason.authorMissing',
        'page-count-invalid': 'reason.pageCountInvalid',
        'price-invalid': 'reason.priceInvalid',
        'publication-month-without-year': 'reason.publicationMonthWithoutYear',
        'publication-year-invalid': 'reason.publicationYearInvalid',
        'publication-month-invalid': 'reason.publicationMonthInvalid',
        'publisher-invalid': 'reason.publisherInvalid',
        'summary-invalid': 'reason.summaryInvalid',
        'note-invalid': 'reason.noteInvalid',
        'cover-too-large': 'reason.coverTooLarge',
        'cover-format': 'reason.coverFormat',
        'cover-address-invalid': 'reason.coverAddressInvalid',
        'cover-address-unavailable': 'reason.coverAddressUnavailable',
        'lookup-cover-missing': 'reason.lookupCoverMissing',
        'lookup-cover-unavailable': 'reason.lookupCoverUnavailable',
        'book-missing': 'reason.bookMissing',
        'book-already-owned': 'reason.bookAlreadyOwned',
        'cover-missing': 'reason.coverMissing',
        'request-too-large': 'reason.requestTooLarge',
        'collection-name-invalid': 'reason.collectionNameInvalid',
        'collection-name-taken': 'reason.collectionNameTaken',
        'collection-missing': 'reason.collectionMissing',
        'volume-invalid': 'reason.volumeInvalid',
        'volume-zero-in-use': 'reason.volumeZeroInUse',
        'collection-incomplete': 'reason.collectionIncomplete',
        'replacement-outdated': 'reason.replacementOutdated',
        'bookcase-name-invalid': 'reason.bookcaseNameInvalid',
        'shelf-name-invalid': 'reason.shelfNameInvalid',
        'tag-name-invalid': 'reason.tagNameInvalid',
        'bookcase-name-taken': 'reason.bookcaseNameTaken',
        'shelf-name-taken': 'reason.shelfNameTaken',
        'tag-name-taken': 'reason.tagNameTaken',
        'bookcase-missing': 'reason.bookcaseMissing',
        'shelf-missing': 'reason.shelfMissing',
        'tag-missing': 'reason.tagMissing',
        'reading-filter-unavailable': 'reason.readingFilterUnavailable',
        'receiver-name-invalid': 'reason.receiverNameInvalid',
        'receiver-missing': 'reason.receiverMissing',
        'receiver-similar': 'reason.receiverSimilar',
        'book-not-owned': 'reason.bookNotOwned',
        'book-already-lent': 'reason.bookAlreadyLent',
        'book-lent': 'reason.bookLent',
        'loan-missing': 'reason.loanMissing',
        'loan-already-returned': 'reason.loanAlreadyReturned',
        'loans-different-receivers': 'reason.loansDifferentReceivers',
        'selection-empty': 'reason.selectionEmpty',
        'selection-duplicate': 'reason.selectionDuplicate',
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
