export interface BackupSummary {
    version: string;
    createdAt: string;
    contents: { books: number; accounts: number };
}

export type WorkerRequest =
    | {
          type: 'start';
          dataDirectory: string;
          host: string;
          httpPort?: number;
          httpPortSource?: 'command-line' | 'environment';
          webDirectory: string;
          development: boolean;
          setupToken: string;
      }
    // Local maintenance; `version` is the running Media Collection version.
    | { type: 'maintenance-status'; dataDirectory: string; version: string }
    | { type: 'recover'; dataDirectory: string; version: string; password: string }
    | { type: 'backup'; dataDirectory: string; version: string; destination: string }
    | { type: 'inspect-backup'; dataDirectory: string; version: string; source: string }
    | { type: 'restore-backup'; dataDirectory: string; version: string; source: string }
    // Development-only data commands; the main process checked the directory first.
    | { type: 'dev-reset'; dataDirectory: string }
    | { type: 'dev-import-v1'; dataDirectory: string; source: string }
    | { type: 'stop' };
export type WorkerResponse =
    | { type: 'ready'; httpPort: number; httpsPort: number | null; httpsError: string | null }
    | { type: 'maintenance-status'; administrator: string | null; hasData: boolean }
    | { type: 'recovered'; username: string }
    | { type: 'backed-up'; backup: BackupSummary }
    | { type: 'backup-inspected'; backup: BackupSummary }
    | { type: 'restored'; backup: BackupSummary }
    | { type: 'maintained'; report: string[] }
    | { type: 'stopped' }
    | {
          type: 'failed';
          message: string;
          reason?: string | null;
          details?: Record<string, unknown> | null;
      };
