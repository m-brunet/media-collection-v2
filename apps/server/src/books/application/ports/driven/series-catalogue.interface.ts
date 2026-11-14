import type { LookupAnswer } from '../../../domain/value-objects/lookup-answer.value-object.js';
import type { SourceReply } from './lookup-source.interface.js';

export type SeriesRecord = {
    isbns: readonly string[];
    subtitle: string | null;
    answer: LookupAnswer;
};

export type SeriesPage = { records: readonly SeriesRecord[]; next: number | null };

export interface SeriesCatalogue {
    readonly name: string;
    editions(isbn13s: readonly string[]): Promise<SourceReply<SeriesRecord[]>>;
    volumes(series: string, publisher: string, start: number): Promise<SourceReply<SeriesPage>>;
}
