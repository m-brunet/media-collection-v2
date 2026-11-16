import type {
    SourceReply,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { SourceHttp } from './source-http.adapter.js';

// The part of an Open Library Books API record ("jscmd=data") the lookups use.
export interface OpenLibraryRecord {
    title?: string;
    subtitle?: string;
    authors?: { name?: string }[];
    publishers?: { name?: string }[];
    publish_date?: string;
    number_of_pages?: number;
    // The work's subjects, shared by its editions.
    subjects?: { name?: string }[];
    cover?: { large?: string; medium?: string };
}

export type OpenLibraryReply = SourceReply<ReadonlyMap<string, OpenLibraryRecord>>;

// Open Library's Books API takes several ISBNs in one request ("bibkeys=ISBN:a,ISBN:b") and
// answers with an object keyed by those same keys. A record holds both the book information and
// the cover address. Covers are addressed by cover id, which Open Library does not rate-limit
// (only its ISBN cover route is).
export class OpenLibraryRecords {
    static readonly address = 'https://openlibrary.org/api/books';
    static readonly batchSize = 20;

    private readonly asked = new Map<string, Promise<OpenLibraryReply>>();

    constructor(
        private readonly http: SourceHttp,
        private readonly address = OpenLibraryRecords.address,
    ) {}

    records(isbn13s: readonly string[], turn: SourceTurn): Promise<OpenLibraryReply> {
        const key = isbn13s.join(',');
        const known = this.asked.get(key);

        if (known) {
            return known;
        }

        const reply = this.fetch(isbn13s, turn).finally(() => this.asked.delete(key));

        this.asked.set(key, reply);

        return reply;
    }

    private async fetch(isbn13s: readonly string[], turn: SourceTurn): Promise<OpenLibraryReply> {
        const query = new URLSearchParams({
            bibkeys: isbn13s.map((isbn13) => 'ISBN:' + isbn13).join(','),
            format: 'json',
            jscmd: 'data',
        });
        const reply = await this.http.get(
            this.address + '?' + query.toString(),
            'application/json',
            turn,
        );

        if (reply.kind !== 'ok') {
            return reply;
        }

        const answered = (await reply.response.json()) as Record<string, OpenLibraryRecord>;
        const records = new Map<string, OpenLibraryRecord>();

        for (const isbn13 of isbn13s) {
            const record = answered['ISBN:' + isbn13];

            if (record) {
                records.set(isbn13, record);
            }
        }

        return { kind: 'found', value: records };
    }
}
