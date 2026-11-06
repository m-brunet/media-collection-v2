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
    | { type: 'recover'; dataDirectory: string; login: string; password: string }
    // Development-only data commands; the main process checked the directory first.
    | { type: 'dev-reset'; dataDirectory: string }
    | { type: 'dev-import-v1'; dataDirectory: string; source: string }
    | { type: 'stop' };
export type WorkerResponse =
    | { type: 'ready'; httpPort: number; httpsPort: number | null; httpsError: string | null }
    | { type: 'recovered' }
    | { type: 'maintained'; report: string[] }
    | { type: 'stopped' }
    | { type: 'failed'; message: string };
