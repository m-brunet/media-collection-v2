import type { BookLookupSources } from '../../../apps/server/src/books/infrastructure/config/books.module.js';
import type { CoverDownloader } from '../../../apps/server/src/books/application/ports/driven/cover-downloader.interface.js';
import type {
    LookupSource,
    SourceReply,
} from '../../../apps/server/src/books/application/ports/driven/lookup-source.interface.js';
import type { CoverOffer } from '../../../apps/server/src/books/domain/services/cover-combination.service.js';
import type { LookupAnswerFields } from '../../../apps/server/src/books/domain/value-objects/lookup-answer.value-object.js';
import { LookupAnswer } from '../../../apps/server/src/books/domain/value-objects/lookup-answer.value-object.js';
import { HttpCoverDownloader } from '../../../apps/server/src/books/infrastructure/adapters/driven/third-party/http-cover-downloader.adapter.js';
import { PublicAddresses } from '../../../apps/server/src/books/infrastructure/adapters/driven/third-party/public-addresses.adapter.js';

class ScriptedSource<T> implements LookupSource<T> {
    readonly limit = { requests: 1000, seconds: 60 };
    readonly asked: string[] = [];
    private readonly replies = new Map<string, SourceReply<T> | 'fail'>();

    constructor(readonly name: string) {}

    answer(isbn13: string, reply: SourceReply<T> | 'fail'): void {
        this.replies.set(isbn13, reply);
    }

    async find(isbn13: string): Promise<SourceReply<T>> {
        this.asked.push(isbn13);
        const reply = this.replies.get(isbn13) ?? { kind: 'none' };

        if (reply === 'fail') {
            throw new Error(this.name + ' is unreachable');
        }

        return reply;
    }
}

class ScriptedDownloader implements CoverDownloader {
    readonly images = new Map<string, Uint8Array>();

    async download(address: string): Promise<Uint8Array | null> {
        return this.images.get(address) ?? null;
    }
}

export class ScriptedLookupSources implements BookLookupSources {
    readonly bnf = new ScriptedSource<LookupAnswer>('bnf');
    readonly openLibrary = new ScriptedSource<LookupAnswer>('openlibrary');
    readonly openLibraryCovers = new ScriptedSource<CoverOffer[]>('openlibrary');
    readonly downloader = new ScriptedDownloader();
    private readonly web = new Map<string, Uint8Array>();
    // Pasted image addresses go through the real downloader and home-network guard, over a
    // scripted web: every host name resolves to a public address and only arranged images answer.
    readonly addressDownloader = new HttpCoverDownloader(
        async (url) => {
            const bytes = this.web.get(url);

            return bytes
                ? new Response(new Blob([new Uint8Array(bytes)]), {
                      headers: { 'Content-Type': 'image/jpeg' },
                  })
                : new Response(null, { status: 404 });
        },
        new PublicAddresses(async () => ['93.184.215.14']),
    );
    readonly information = [this.bnf, this.openLibrary];
    readonly covers = [this.openLibraryCovers];

    knows(name: 'bnf' | 'openlibrary', isbn13: string, fields: LookupAnswerFields): void {
        const source = name === 'bnf' ? this.bnf : this.openLibrary;

        source.answer(isbn13, { kind: 'found', value: LookupAnswer.of(fields) });
    }

    cover(isbn13: string, address: string, bytes: Uint8Array): void {
        this.openLibraryCovers.answer(isbn13, {
            kind: 'found',
            value: [{ address, width: 400, height: 600, fingerprint: null }],
        });
        this.downloader.images.set(address, bytes);
    }

    webImage(address: string, bytes: Uint8Array): void {
        this.web.set(address, bytes);
    }
}
