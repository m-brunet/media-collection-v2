import type { MembershipRequest } from './ports/driven/collection-membership.interface.js';
import type { TagChoice } from './ports/driven/tag-assignment.interface.js';
import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

// `distinct` confirms that a name similar to an existing author is really someone else.
export type AuthorChoice = { id: string } | { name: string; distinct?: boolean };

// An absent field keeps its current value.
export type OrganisationRequest = { shelfId?: string | null; tags?: readonly TagChoice[] };

export interface BookInput {
    title: string;
    isbn: string | null;
    noIsbn: boolean;
    authors: AuthorChoice[];
    category: BookCategory;
    ownership: Ownership;
    publisher: string | null;
    publicationYear: number | null;
    publicationMonth: number | null;
    summary: string | null;
    pageCount: number | null;
    // As typed: comma or dot, at most two decimals; null when unknown.
    price: string | null;
    // Confirms a new no-ISBN book although a similar saved book was found.
    confirmDistinct?: boolean;
    collection: MembershipRequest | null;
    // Planned Not Owned books the person chose to delete because this Owned book replaces them.
    replacePlanned?: string[];
    shelfId: string | null;
    tags: TagChoice[];
}
