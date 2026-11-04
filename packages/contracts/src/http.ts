export type AccountRole = 'admin' | 'owner' | 'guest';

// The signed-in account.
export interface Account {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    language: 'en' | 'fr' | null;
}

// An account as listed for the administrator.
export interface AccountSummary {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    active: boolean;
}

export interface SetupStatus {
    // True until the protected administrator exists (first launch).
    required: boolean;
    // True when this request comes from the computer running Media Collection, where setup is allowed.
    local: boolean;
}

// Error body of every failed API request.
export interface ApiFailure {
    code: string;
    reason?: string | null;
    message: string;
}

export interface TlsConfiguration {
    enabled: boolean;
    port: number;
    hasCertificate: boolean;
}

export interface ServerStatus {
    configured: {
        http: { port: number };
        tls: TlsConfiguration;
    };
    running: {
        httpPort: number;
        httpsPort: number | null;
        httpsError: string | null;
        addresses: string[];
        httpPortOverride: { port: number; source: 'command-line' | 'environment' } | null;
    };
    restartRequired: boolean;
}
