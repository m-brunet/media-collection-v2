// Technical audit categories of account and authentication changes. None of them appear in the
// shared Activity view; they exist for investigation only.
export const AccountAudit = {
    subject: 'account',
    setup: 'setup.administrator-created',
    created: 'account.created',
    passwordReset: 'account.password-reset',
    deactivated: 'account.deactivated',
    reactivated: 'account.reactivated',
    renamed: 'account.renamed',
    passwordChanged: 'account.password-changed',
    languageChanged: 'account.language-changed',
    signedIn: 'authentication.signed-in',
    recovered: 'account.recovered',
} as const;
