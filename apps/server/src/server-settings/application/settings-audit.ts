// Technical audit categories of server settings changes (never shown in Activity).
export const SettingsAudit = {
    subject: 'server-settings',
    http: 'server-settings.http-changed',
    https: 'server-settings.https-changed',
    internetAccessSetUp: 'server-settings.internet-access-set-up',
    internetAccessTurnedOff: 'server-settings.internet-access-turned-off',
    keepAwake: 'server-settings.keep-awake-changed',
} as const;
