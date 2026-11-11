import type { AuthorSpellingDto } from '../../../../../packages/contracts/src/http';
import type { DraftAuthor } from './book-draft.util';
import { BookDraft } from './book-draft.util';

// A lookup fills in an existing author's name for a source's similar spelling. While the form
// holds the existing author, it offers the source's spelling; once the person took the source's
// spelling, it offers the existing author back.
export class AuthorSpellings {
    // The spellings whose existing author is in the form.
    static offered(authors: DraftAuthor[], spellings: AuthorSpellingDto[]): AuthorSpellingDto[] {
        return spellings.filter((spelling) =>
            authors.some((author) => AuthorSpellings.same(author.name, spelling.name)),
        );
    }

    // The spellings the form took instead of the existing author.
    static taken(authors: DraftAuthor[], spellings: AuthorSpellingDto[]): AuthorSpellingDto[] {
        return spellings.filter((spelling) =>
            authors.some((author) => AuthorSpellings.same(author.name, spelling.spelling)),
        );
    }

    // The source's spelling instead: a new author, confirmed as different from the existing one.
    static used(authors: DraftAuthor[], spelling: AuthorSpellingDto): DraftAuthor[] {
        return authors.map((author) =>
            AuthorSpellings.same(author.name, spelling.name)
                ? { id: null, name: spelling.spelling, distinct: true }
                : author,
        );
    }

    // The existing author back instead of the source's spelling.
    static restored(authors: DraftAuthor[], spelling: AuthorSpellingDto): DraftAuthor[] {
        return authors.map((author) =>
            AuthorSpellings.same(author.name, spelling.spelling)
                ? { id: null, name: spelling.name, distinct: false }
                : author,
        );
    }

    // The authors as the lookup filled them in, every source spelling taken named as the existing
    // author: the lookup's value still counts as held.
    static asFilledIn(authors: DraftAuthor[], spellings: AuthorSpellingDto[]): DraftAuthor[] {
        return spellings.reduce(
            (current, spelling) => AuthorSpellings.restored(current, spelling),
            authors,
        );
    }

    private static same(first: string, second: string): boolean {
        return BookDraft.nameKey(first) === BookDraft.nameKey(second);
    }
}
