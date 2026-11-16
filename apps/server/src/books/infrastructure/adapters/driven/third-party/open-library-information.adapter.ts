import type {
    LookupSource,
    SourceReply,
    SourceTurn,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { BookCategory } from '../../../../domain/entities/book.entity.js';
import type { LookupDate } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import type { OpenLibraryRecord } from './open-library-records.adapter.js';
import { OpenLibraryRecords } from './open-library-records.adapter.js';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Open Library gives no edition language and no summary in these records.
export class OpenLibraryInformation implements LookupSource<LookupAnswer> {
    readonly name = 'openlibrary';
    readonly batchSize = OpenLibraryRecords.batchSize;

    constructor(private readonly records: OpenLibraryRecords) {}

    async find(
        isbn13s: readonly string[],
        turn: SourceTurn,
    ): Promise<SourceReply<ReadonlyMap<string, LookupAnswer>>> {
        const reply = await this.records.records(isbn13s, turn);

        if (reply.kind !== 'found') {
            return reply;
        }

        const answers = new Map<string, LookupAnswer>();

        for (const [isbn13, record] of reply.value) {
            const answer = OpenLibraryInformation.answer(record);

            if (!answer.empty) {
                answers.set(isbn13, answer);
            }
        }

        return { kind: 'found', value: answers };
    }

    private static answer(record: OpenLibraryRecord): LookupAnswer {
        return LookupAnswer.of({
            title: [record.title, record.subtitle].filter(Boolean).join(' : '),
            authors: (record.authors ?? []).map((author) => author.name ?? ''),
            publisher: record.publishers?.[0]?.name ?? null,
            publicationDate: OpenLibraryInformation.date(record.publish_date),
            pageCount: record.number_of_pages ?? null,
            category: OpenLibraryInformation.category(record),
        });
    }

    // The work's subjects: "Comics & graphic novels, manga, …" or "Manhwa" make a manga;
    // "Comic books, strips", "Graphic novels" or "Bandes dessinées" a comic. Anything else: no
    // category, the form keeps its own. Publishers are not used: some publish both.
    private static category(record: OpenLibraryRecord): BookCategory | null {
        const subjects = (record.subjects ?? []).map((subject) => subject.name ?? '');

        if (subjects.some((subject) => /\b(manga|manhwa|manhua)\b/i.test(subject))) {
            return 'manga';
        }

        return subjects.some((subject) =>
            /\bcomic|\bgraphic novel|\bbandes dessinées/i.test(subject),
        )
            ? 'comics'
            : null;
    }

    // "2012", "March 2012", "Mar 1, 2012", "2012-03-01": the year, and the month when given.
    private static date(value: string | undefined): LookupDate | null {
        const text = value?.toLowerCase() ?? '';
        const year = text.match(/(\d{4})/)?.[1];

        if (!year) {
            return null;
        }

        const iso = text.match(/^\d{4}-(\d{2})/)?.[1];
        const named = months.findIndex((month) => new RegExp('\\b' + month).test(text));

        return {
            year: Number(year),
            month: iso ? Number(iso) : named >= 0 ? named + 1 : null,
        };
    }
}
