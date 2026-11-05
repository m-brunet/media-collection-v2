export type AccountRole = 'admin' | 'owner' | 'guest';

// The signed-in account.
export interface Account {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    language: 'en' | 'fr' | null;
}

// An account as listed for the administrator.
export interface AccountSummary {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    active: boolean;
}

export interface SetupStatus {
    // True until the protected administrator exists (first launch).
    required: boolean;
    // True only in the Media Collection desktop window, the one place where setup is allowed.
    allowed: boolean;
}

// Error body of every failed API request.
export interface ApiFailure {
    code: string;
    reason?: string | null;
    message: string;
    details?: Record<string, unknown>;
}

export interface TlsConfiguration {
    enabled: boolean;
    port: number;
    hasCertificate: boolean;
}

export interface ServerStatus {
    configured: {
        http: { port: number };
        tls: TlsConfiguration;
    };
    running: {
        httpPort: number;
        httpsPort: number | null;
        httpsError: string | null;
        addresses: string[];
        httpPortOverride: { port: number; source: 'command-line' | 'environment' } | null;
    };
    restartRequired: boolean;
}

export type ColorSchemeName = 'mint' | 'emerald' | 'forest' | 'spring-green';

// Installation-wide appearance, readable before sign-in.
export interface Appearance {
    colorScheme: ColorSchemeName;
}

export type BookCategory = 'books' | 'manga' | 'comics';
export type BookOwnership = 'owned' | 'not-owned';
export type BookSort = 'title' | 'added' | 'published';

export interface AuthorDto {
    id: string;
    name: string;
}

// An author of a book being saved: an existing one, or a name to reuse or create. `distinct`
// confirms that a name similar to an existing author is really someone else.
export type AuthorChoiceDto = { id: string } | { name: string; distinct?: boolean };

// The collection of a book being saved: an existing one, or a name to join or create.
// `distinct` confirms that a name similar to an existing collection is another collection.
export type CollectionChoiceDto = { id: string } | { name: string; distinct?: boolean };

// Membership and covered volumes (equal numbers for a single volume). `enableVolumeZero`
// answers the request to include volume 0 in the collection.
export interface MembershipDto {
    collection: CollectionChoiceDto;
    volumeFrom: number;
    volumeTo: number;
    enableVolumeZero?: boolean;
}

export interface BookCollectionDto {
    id: string;
    name: string;
    volumeFrom: number;
    volumeTo: number;
}

// Shared information of a book as entered in the form.
export interface BookInputDto {
    title: string;
    isbn: string | null;
    noIsbn: boolean;
    authors: AuthorChoiceDto[];
    category: BookCategory;
    ownership: BookOwnership;
    publisher: string | null;
    publicationYear: number | null;
    publicationMonth: number | null;
    summary: string | null;
    pageCount: number | null;
    price: string | null;
    confirmDistinct?: boolean;
    collection: MembershipDto | null;
    // Planned Not Owned books to delete because this Owned book replaces them.
    replacePlanned?: string[];
}

export interface NewBookDto extends BookInputDto {
    // The creator's own reading status.
    read: boolean;
}

export interface PersonalNoteDto {
    text: string;
    updatedAt: string;
}

export interface BookDto {
    id: string;
    title: string;
    isbn: string | null;
    isbnConvertedFromIsbn10: boolean;
    noIsbn: boolean;
    authors: AuthorDto[];
    category: BookCategory;
    ownership: BookOwnership;
    publisher: string | null;
    publicationYear: number | null;
    publicationMonth: number | null;
    summary: string | null;
    pageCount: number | null;
    priceCents: number | null;
    hasCover: boolean;
    collection: BookCollectionDto | null;
    createdAt: string;
    updatedAt: string;
    // The viewer's own reading status and note; null for Guests.
    personal: { read: boolean; note: PersonalNoteDto | null } | null;
}

export interface BookListItemDto {
    id: string;
    title: string;
    authors: string[];
    category: BookCategory;
    ownership: BookOwnership;
    hasCover: boolean;
    collection: { name: string; volumeFrom: number; volumeTo: number } | null;
    updatedAt: string;
    read: boolean | null;
}

export interface BookListPageDto {
    total: number;
    items: BookListItemDto[];
}

// `details` of a failure with reason `author-similar`.
export interface SimilarAuthorDetails {
    name: string;
    candidates: AuthorDto[];
}

// `details` of a failure with reason `possible-duplicate`.
export interface PossibleDuplicateDetails {
    candidates: { id: string; title: string; authors: string[] }[];
}

// `details` of a failure with reason `collection-similar`.
export interface SimilarCollectionDetails {
    name: string;
    candidates: { id: string; name: string }[];
}

// `details` of a failure with reason `volume-zero-disabled`.
export interface VolumeZeroDetails {
    name: string;
}

export interface CoverageConflictBook {
    id: string;
    title: string;
    isbn: string | null;
    ownership: BookOwnership;
    volumeFrom: number;
    volumeTo: number;
}

// `details` of a failure with reason `coverage-conflict`. Replaceable when the book being saved
// is Owned and every conflicting book is a planned Not Owned record; the expected range after
// replacing them is given so the person can see whether it shrinks.
export interface CoverageConflictDetails {
    name: string;
    conflicts: CoverageConflictBook[];
    replaceable: boolean;
    expectedAfterReplacement: { from: number; to: number | null } | null;
}

export type VolumeState = 'owned' | 'planned' | 'inferred';

export interface CollectionSummaryDto {
    id: string;
    name: string;
    includesVolumeZero: boolean;
    finished: boolean;
    bookCount: number;
    expectedFrom: number;
    expectedTo: number;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
}

export interface CollectionMemberDto {
    id: string;
    title: string;
    isbn: string | null;
    category: BookCategory;
    ownership: BookOwnership;
    hasCover: boolean;
    volumeFrom: number;
    volumeTo: number;
}

export interface CollectionVolumeDto {
    from: number;
    to: number;
    state: VolumeState;
    books: CollectionMemberDto[];
}

export interface CollectionDetailsDto extends CollectionSummaryDto {
    volumes: CollectionVolumeDto[];
}

export interface CollectionListPageDto {
    total: number;
    items: CollectionSummaryDto[];
}

export interface CollectionNameDto {
    id: string;
    name: string;
    includesVolumeZero: boolean;
}

export interface CollectionChangesDto {
    name?: string;
    includesVolumeZero?: boolean;
}
