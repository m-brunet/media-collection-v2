import type { MembershipRequest } from './ports/driven/collection-membership.interface.js';
import type { TagChoice } from './ports/driven/tag-assignment.interface.js';
import type { BookCategory, Ownership } from '../domain/entities/book.entity.js';

export type AuthorChoice = { id: string } | { name: string; distinct?: boolean };

export type AuthorMatch = { id: string | null; name: string };

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
    price: string | null;
    confirmDistinct?: boolean;
    collection: MembershipRequest | null;
    replacePlanned?: string[];
    shelfId: string | null;
    tags: TagChoice[];
}
