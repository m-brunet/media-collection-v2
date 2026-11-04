// Technical audit categories of server settings changes (never shown in Activity).
export const SettingsAudit = {
    subject: 'server-settings',
    http: 'server-settings.http-changed',
    https: 'server-settings.https-changed',
} as const;
