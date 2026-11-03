export type WorkerRequest =
    | {
          type: 'start';
          dataDirectory: string;
          host: string;
          httpPort?: number;
          httpPortSource?: 'command-line' | 'environment';
          webDirectory: string;
          development: boolean;
      }
    | { type: 'recover'; dataDirectory: string; login: string; password: string }
    | { type: 'stop' };
export type WorkerResponse =
    | { type: 'ready'; httpPort: number; httpsPort: number | null; httpsError: string | null }
    | { type: 'recovered' }
    | { type: 'stopped' }
    | { type: 'failed'; message: string };
