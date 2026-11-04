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
    // True only in the Media Collection desktop window, the one place where setup is allowed.
    allowed: boolean;
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

export type ColorSchemeName = 'mint' | 'emerald' | 'forest' | 'spring-green';

// Installation-wide appearance, readable before sign-in.
export interface Appearance {
    colorScheme: ColorSchemeName;
}
