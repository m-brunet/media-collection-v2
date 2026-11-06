import type {
    LookupSource,
    SourceReply,
} from '../../../../application/ports/driven/lookup-source.interface.js';
import type { LookupDate } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import { LookupAnswer } from '../../../../domain/value-objects/lookup-answer.value-object.js';
import type { OpenLibraryRecord, OpenLibraryRecords } from './open-library-records.adapter.js';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Book information from Open Library: title, authors, publisher, date and page count. It gives
// no edition language and no summary in these records.
export class OpenLibraryInformation implements LookupSource<LookupAnswer> {
    readonly name = 'openlibrary';
    // Kept well below Open Library's published limits for identified clients.
    readonly limit = { requests: 20, seconds: 60 };

    constructor(private readonly records: OpenLibraryRecords) {}

    async find(isbn13: string): Promise<SourceReply<LookupAnswer>> {
        const reply = await this.records.record(isbn13);

        if (reply.kind !== 'found') {
            return reply;
        }

        const answer = OpenLibraryInformation.answer(reply.value);

        return answer.empty ? { kind: 'none' } : { kind: 'found', value: answer };
    }

    private static answer(record: OpenLibraryRecord): LookupAnswer {
        return LookupAnswer.of({
            title: [record.title, record.subtitle].filter(Boolean).join(' : '),
            authors: (record.authors ?? []).map((author) => author.name ?? ''),
            publisher: record.publishers?.[0]?.name ?? null,
            publicationDate: OpenLibraryInformation.date(record.publish_date),
            pageCount: record.number_of_pages ?? null,
        });
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
