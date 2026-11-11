import type { AuthorSpellingDto } from '../../../../../packages/contracts/src/http';
import type { DraftAuthor } from './book-draft.util';
import { BookDraft } from './book-draft.util';

// A lookup fills in an existing author's name for a source's similar spelling; the form offers
// the source's spelling while that author is still in it.
export class AuthorSpellings {
    static offered(authors: DraftAuthor[], spellings: AuthorSpellingDto[]): AuthorSpellingDto[] {
        return spellings.filter((spelling) =>
            authors.some((author) => AuthorSpellings.same(author.name, spelling.name)),
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

    private static same(first: string, second: string): boolean {
        return BookDraft.nameKey(first) === BookDraft.nameKey(second);
    }
}
