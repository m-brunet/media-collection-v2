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
