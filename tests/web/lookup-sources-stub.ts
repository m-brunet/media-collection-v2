import { readFileSync } from 'node:fs';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import { createServer } from 'node:http';

type Source = 'bnf' | 'openlibrary';
type Trouble = { status: 500 } | { status: 503; retryAfterSeconds: number };

const recorded = new URL(
    '../../apps/server/src/books/infrastructure/adapters/driven/third-party/fixtures/',
    import.meta.url,
);

// A local stand-in for BnF's SRU catalogue and Open Library's Books API and covers, so browser
// journeys run Find book through the real backend chain without reaching the internet. BnF
// answers come from the recorded adapter fixtures; Open Library records are written here.
export class LookupSourcesStub {
    private server: Server | undefined;
    private port = 0;
    private readonly bnfRecords = new Map<string, string>();
    private readonly openLibraryRecords = new Map<string, object>();
    private readonly troubles = new Map<Source, Trouble>();
    private readonly cover: Buffer;
    // Paths asked so far, to check which sources a journey reached.
    readonly requests: string[] = [];

    constructor(cover: Buffer) {
        this.cover = cover;
    }

    get addresses(): { bnf: string; openLibrary: string } {
        const base = 'http://127.0.0.1:' + this.port;

        return { bnf: base + '/bnf/SRU', openLibrary: base + '/openlibrary/api/books' };
    }

    // The ISBN's BnF record, from a recorded answer (for example `bnf-ewilan-1.xml`).
    bnf(isbn13: string, fixture: string): this {
        this.bnfRecords.set(isbn13, readFileSync(new URL(fixture, recorded), 'utf8'));

        return this;
    }

    // An Open Library record for the ISBN; `cover: true` offers the stub's cover picture.
    openLibrary(
        isbn13: string,
        record: { title: string; authors: string[]; publisher: string; cover: boolean },
    ): this {
        const cover = 'http://127.0.0.1:' + this.port + '/covers/b/id/' + isbn13 + '-L.png';

        this.openLibraryRecords.set(isbn13, {
            title: record.title,
            authors: record.authors.map((name) => ({ name })),
            publishers: [{ name: record.publisher }],
            ...(record.cover ? { cover: { large: cover } } : {}),
        });

        return this;
    }

    // Makes the source fail (500) or ask to retry later (503 with Retry-After) until `recover`.
    trouble(source: Source, trouble: Trouble): this {
        this.troubles.set(source, trouble);

        return this;
    }

    recover(source: Source): this {
        this.troubles.delete(source);

        return this;
    }

    reset(): void {
        this.bnfRecords.clear();
        this.openLibraryRecords.clear();
        this.troubles.clear();
        this.requests.length = 0;
    }

    async start(): Promise<void> {
        const server = createServer((request, response) => this.answer(request, response));

        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        this.server = server;
        this.port = (server.address() as { port: number }).port;
    }

    async close(): Promise<void> {
        await new Promise<void>((resolve) =>
            this.server ? this.server.close(() => resolve()) : resolve(),
        );
    }

    private answer(request: IncomingMessage, response: ServerResponse): void {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');

        this.requests.push(url.pathname);

        if (url.pathname.startsWith('/covers/')) {
            response.writeHead(200, { 'Content-Type': 'image/png' }).end(this.cover);
        } else if (url.pathname === '/bnf/SRU') {
            this.reply('bnf', response, () => {
                const isbn = (url.searchParams.get('query') ?? '').match(/\d{13}/)?.[0] ?? '';

                return {
                    type: 'application/xml',
                    body: this.bnfRecords.get(isbn) ?? LookupSourcesStub.bnfNone(),
                };
            });
        } else if (url.pathname === '/openlibrary/api/books') {
            this.reply('openlibrary', response, () => {
                const key = url.searchParams.get('bibkeys') ?? '';
                const record = this.openLibraryRecords.get(key.replace('ISBN:', ''));

                return {
                    type: 'application/json',
                    body: JSON.stringify(record ? { [key]: record } : {}),
                };
            });
        } else {
            response.writeHead(404).end();
        }
    }

    private reply(
        source: Source,
        response: ServerResponse,
        found: () => { type: string; body: string },
    ): void {
        const trouble = this.troubles.get(source);

        if (trouble?.status === 503) {
            response.writeHead(503, { 'Retry-After': String(trouble.retryAfterSeconds) }).end();
        } else if (trouble) {
            response.writeHead(500).end();
        } else {
            const { type, body } = found();

            response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }).end(body);
        }
    }

    private static bnfNone(): string {
        return readFileSync(new URL('bnf-none.xml', recorded), 'utf8');
    }
}
