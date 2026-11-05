import type { MembershipRequest } from './ports/driven/collection-membership.interface.js';
import type { TagChoice } from './ports/driven/tag-assignment.interface.js';
import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

// One author of a book being saved: an existing author, or a name to reuse or create.
// `distinct` confirms that a name similar to an existing author is really someone else.
export type AuthorChoice = { id: string } | { name: string; distinct?: boolean };

// Location and tags to apply to a book; an absent field keeps its current value.
export type OrganisationRequest = { shelfId?: string | null; tags?: readonly TagChoice[] };

// Book information as entered in the form, before validation.
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
    // The collection the book belongs to, with the volumes it covers; null for none.
    collection: MembershipRequest | null;
    // Planned Not Owned books the person chose to delete because this Owned book replaces them.
    replacePlanned?: string[];
    // The shelf the book is kept on; null when unassigned.
    shelfId: string | null;
    tags: TagChoice[];
}
