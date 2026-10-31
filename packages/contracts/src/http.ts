export interface Account {
    id: string;
    username: string;
    role: 'admin' | 'user';
    mustChangePassword: boolean;
}

export interface NoteDto {
    id: string;
    title: string;
    body: string;
    createdAt: string;
    updatedAt: string;
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
