import type { SeriesEntry } from '../../../domain/services/series-volumes.service.js';
import type { SourceReply } from './lookup-source.interface.js';

export type SeriesRecord = SeriesEntry;

export type SeriesPage = { records: readonly SeriesRecord[]; next: number | null };

export interface SeriesCatalogue {
    readonly name: string;
    readonly limit: { requests: number; seconds: number };
    editions(isbn13s: readonly string[]): Promise<SourceReply<SeriesRecord[]>>;
    volumes(series: string, publisher: string, start: number): Promise<SourceReply<SeriesPage>>;
}
