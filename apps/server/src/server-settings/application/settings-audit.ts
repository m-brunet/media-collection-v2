// Technical audit categories of server settings changes (never shown in Activity).
export const SettingsAudit = {
    subject: 'server-settings',
    http: 'server-settings.http-changed',
    https: 'server-settings.https-changed',
    internetAccessSetUp: 'server-settings.internet-access-set-up',
    internetAccessTurnedOff: 'server-settings.internet-access-turned-off',
    keepAwake: 'server-settings.keep-awake-changed',
    domainName: 'server-settings.domain-name-changed',
    httpInternetAccessOpened: 'server-settings.http-internet-access-opened',
    httpInternetAccessClosed: 'server-settings.http-internet-access-closed',
} as const;
