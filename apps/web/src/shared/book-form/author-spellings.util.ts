import type { AuthorSpellingDto } from '../../../../../packages/contracts/src/http';
import type { DraftAuthor } from './book-draft.util';
import { BookDraft } from './book-draft.util';

export class AuthorSpellings {
    static offered(authors: DraftAuthor[], spellings: AuthorSpellingDto[]): AuthorSpellingDto[] {
        return spellings.filter((spelling) =>
            authors.some((author) => AuthorSpellings.same(author.name, spelling.name)),
        );
    }

    static taken(authors: DraftAuthor[], spellings: AuthorSpellingDto[]): AuthorSpellingDto[] {
        return spellings.filter((spelling) =>
            authors.some((author) => AuthorSpellings.same(author.name, spelling.spelling)),
        );
    }

    static used(authors: DraftAuthor[], spelling: AuthorSpellingDto): DraftAuthor[] {
        return authors.map((author) =>
            AuthorSpellings.same(author.name, spelling.name)
                ? { id: null, name: spelling.spelling, distinct: true }
                : author,
        );
    }

    static restored(authors: DraftAuthor[], spelling: AuthorSpellingDto): DraftAuthor[] {
        return authors.map((author) =>
            AuthorSpellings.same(author.name, spelling.spelling)
                ? { id: null, name: spelling.name, distinct: false }
                : author,
        );
    }

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
