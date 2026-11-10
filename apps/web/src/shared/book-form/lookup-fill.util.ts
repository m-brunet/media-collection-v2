import type {
    BookLookupFieldsDto,
    LookupChoiceDto,
} from '../../../../../packages/contracts/src/http';
import type { BookDraftValues } from './book-draft.util';
import { BookDraft } from './book-draft.util';

export type LookupField =
    | 'title'
    | 'authors'
    | 'publisher'
    | 'publication'
    | 'pageCount'
    | 'summary'
    | 'collection';

// The value the person picked for each field in the review; null leaves the field alone.
export interface LookupSelection {
    title: string | null;
    authors: string[] | null;
    publisher: string | null;
    publication: { year: number; month: number | null } | null;
    pageCount: number | null;
    summary: string | null;
    collection: { name: string; volume: number } | null;
}

export interface LookupConflict {
    field: LookupField;
    mine: string;
    lookup: string;
}

export class LookupFill {
    static readonly fields: LookupField[] = [
        'title',
        'authors',
        'publisher',
        'publication',
        'pageCount',
        'summary',
        'collection',
    ];

    // The choices offered for a field, the preferred source's first.
    static choices(fields: BookLookupFieldsDto, field: LookupField): LookupChoiceDto<unknown>[] {
        return field === 'publication' ? fields.publicationDate : fields[field];
    }

    // A Manga or Comics in a collection with a blank title keeps its generated title unless the
    // person picks the lookup's.
    static keepsGeneratedTitle(draft: BookDraftValues, fields: BookLookupFieldsDto): boolean {
        return (
            (draft.category === 'manga' || draft.category === 'comics') &&
            draft.title.trim() === '' &&
            (draft.inCollection || fields.collection.length > 0)
        );
    }

    static defaults(fields: BookLookupFieldsDto, draft: BookDraftValues): LookupSelection {
        return {
            title: LookupFill.keepsGeneratedTitle(draft, fields)
                ? null
                : (fields.title[0]?.value ?? null),
            authors: fields.authors[0]?.value ?? null,
            publisher: fields.publisher[0]?.value ?? null,
            publication: fields.publicationDate[0]?.value ?? null,
            pageCount: fields.pageCount[0]?.value ?? null,
            summary: fields.summary[0]?.value ?? null,
            collection: fields.collection[0]?.value ?? null,
        };
    }

    static prefilled(draft: BookDraftValues, fields: BookLookupFieldsDto): BookDraftValues {
        return LookupFill.apply(draft, LookupFill.defaults(fields, draft)).next;
    }

    static apply(
        draft: BookDraftValues,
        selection: LookupSelection,
    ): { next: BookDraftValues; conflicts: LookupConflict[] } {
        let next = draft;
        const conflicts: LookupConflict[] = [];

        for (const field of LookupFill.fields) {
            const lookup = LookupFill.lookupText(selection, field);

            if (lookup === null) {
                continue;
            }

            const mine = LookupFill.draftText(next, field);

            if (mine === '') {
                next = BookDraft.changed(next, LookupFill.write(selection, field));
            } else if (LookupFill.key(field, mine) !== LookupFill.key(field, lookup)) {
                conflicts.push({ field, mine, lookup });
            }
        }

        return { next, conflicts };
    }

    static replace(
        draft: BookDraftValues,
        selection: LookupSelection,
        fields: readonly LookupField[],
    ): BookDraftValues {
        return fields.reduce(
            (next, field) => BookDraft.changed(next, LookupFill.write(selection, field)),
            draft,
        );
    }

    static only(field: LookupField, value: unknown): LookupSelection {
        return {
            title: null,
            authors: null,
            publisher: null,
            publication: null,
            pageCount: null,
            summary: null,
            collection: null,
            [field]: value,
        } as LookupSelection;
    }

    static holds(draft: BookDraftValues, field: LookupField, value: unknown): boolean {
        const lookup = LookupFill.lookupText(LookupFill.only(field, value), field);

        return (
            lookup !== null &&
            LookupFill.key(field, LookupFill.draftText(draft, field)) ===
                LookupFill.key(field, lookup)
        );
    }

    static text(field: LookupField, value: unknown): string {
        return LookupFill.lookupText(LookupFill.only(field, value), field) ?? '';
    }

    private static write(selection: LookupSelection, field: LookupField): Partial<BookDraftValues> {
        switch (field) {
            case 'title':
                return { title: selection.title! };
            case 'authors':
                return {
                    authors: selection.authors!.map((name) => ({
                        id: null,
                        name,
                        distinct: false,
                    })),
                };
            case 'publisher':
                return { publisher: selection.publisher! };
            case 'publication':
                return {
                    publicationYear: String(selection.publication!.year),
                    publicationMonth:
                        selection.publication!.month === null
                            ? ''
                            : String(selection.publication!.month),
                };
            case 'pageCount':
                return { pageCount: String(selection.pageCount!) };
            case 'summary':
                return { summary: selection.summary! };
            case 'collection':
                return {
                    inCollection: true,
                    collectionName: selection.collection!.name,
                    collectionDistinct: false,
                    omnibus: false,
                    volumeFrom: String(selection.collection!.volume),
                    volumeTo: String(selection.collection!.volume),
                };
        }
    }

    private static draftText(draft: BookDraftValues, field: LookupField): string {
        switch (field) {
            case 'title':
                return draft.title.trim();
            case 'authors':
                return draft.authors.map((author) => author.name).join(', ');
            case 'publisher':
                return draft.publisher.trim();
            case 'publication':
                return LookupFill.date(draft.publicationYear.trim(), draft.publicationMonth);
            case 'pageCount':
                return draft.pageCount.trim();
            case 'summary':
                return draft.summary.trim();
            case 'collection':
                return draft.inCollection && draft.collectionName.trim()
                    ? LookupFill.membership(
                          draft.collectionName.trim(),
                          draft.omnibus
                              ? draft.volumeFrom + '–' + draft.volumeTo
                              : draft.volumeFrom.trim(),
                      )
                    : '';
        }
    }

    private static lookupText(selection: LookupSelection, field: LookupField): string | null {
        switch (field) {
            case 'authors':
                return selection.authors?.length ? selection.authors.join(', ') : null;
            case 'publication':
                return selection.publication
                    ? LookupFill.date(
                          String(selection.publication.year),
                          selection.publication.month === null
                              ? ''
                              : String(selection.publication.month),
                      )
                    : null;
            case 'pageCount':
                return selection.pageCount === null ? null : String(selection.pageCount);
            case 'collection':
                return selection.collection
                    ? LookupFill.membership(
                          selection.collection.name,
                          String(selection.collection.volume),
                      )
                    : null;
            default:
                return selection[field];
        }
    }

    private static date(year: string, month: string): string {
        if (!year) {
            return '';
        }

        return month ? month + '/' + year : year;
    }

    private static membership(name: string, volumes: string): string {
        return name + ' · ' + volumes;
    }

    private static key(field: LookupField, text: string): string {
        if (field === 'authors') {
            return text
                .split(', ')
                .map((name) => BookDraft.nameKey(name))
                .sort()
                .join('|');
        }

        return BookDraft.nameKey(text);
    }
}
