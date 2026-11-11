import type { SourceReply } from '../../../../application/ports/driven/lookup-source.interface.js';
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

// Open Library's Books API, asked once per ISBN for both the book information and the cover: a
// record fetched for one is reused by the other for a minute. Covers are then addressed by
// cover id, which Open Library does not rate-limit (only its ISBN cover route is).
export class OpenLibraryRecords {
    static readonly address = 'https://openlibrary.org/api/books';
    static readonly reuseSeconds = 60;

    private readonly recent = new Map<
        string,
        { at: number; reply: Promise<SourceReply<OpenLibraryRecord>> }
    >();

    constructor(
        private readonly http: SourceHttp,
        private readonly address = OpenLibraryRecords.address,
        private readonly now: () => Date = () => new Date(),
    ) {}

    record(isbn13: string): Promise<SourceReply<OpenLibraryRecord>> {
        const now = this.now().getTime();

        for (const [isbn, entry] of this.recent) {
            if (now - entry.at >= OpenLibraryRecords.reuseSeconds * 1000) {
                this.recent.delete(isbn);
            }
        }

        const kept = this.recent.get(isbn13);

        if (kept) {
            return kept.reply;
        }

        const reply = this.fetch(isbn13);

        this.recent.set(isbn13, { at: now, reply });
        // A failed request is not reused: the next lookup asks again.
        reply.catch(() => this.recent.delete(isbn13));

        return reply;
    }

    private async fetch(isbn13: string): Promise<SourceReply<OpenLibraryRecord>> {
        const key = 'ISBN:' + isbn13;
        const query = new URLSearchParams({ bibkeys: key, format: 'json', jscmd: 'data' });
        const reply = await this.http.get(
            this.address + '?' + query.toString(),
            'application/json',
        );

        if (reply.kind === 'limited') {
            return reply;
        }

        const records = (await reply.response.json()) as Record<string, OpenLibraryRecord>;
        const record = records[key];

        return record ? { kind: 'found', value: record } : { kind: 'none' };
    }
}
