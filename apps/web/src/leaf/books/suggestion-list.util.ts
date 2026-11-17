import { BookDraft } from '../../shared/book-form/book-draft.util';

export interface Suggestion {
    key: string;
    label: string;
}

export class SuggestionList {
    static readonly limit = 5;

    static of(
        candidates: readonly { id: string; name: string }[],
        typed: string,
        taken: readonly string[] = [],
    ): Suggestion[] {
        if (typed.trim() === '') {
            return [];
        }

        const used = new Set(taken.map((name) => BookDraft.nameKey(name)));
        const search = BookDraft.nameKey(typed);

        return candidates
            .filter(
                (candidate) =>
                    candidate.name.trim() !== typed.trim() &&
                    BookDraft.nameKey(candidate.name).includes(search) &&
                    !used.has(BookDraft.nameKey(candidate.name)),
            )
            .slice(0, SuggestionList.limit)
            .map((candidate) => ({ key: candidate.id, label: candidate.name }));
    }
}
