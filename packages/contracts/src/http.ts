export type AccountRole = 'admin' | 'owner' | 'guest';

export interface Account {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    language: 'en' | 'fr' | null;
}

export interface AccountSummary {
    id: string;
    username: string;
    role: AccountRole;
    mustChangePassword: boolean;
    active: boolean;
}

export interface SetupStatus {
    required: boolean;
    allowed: boolean;
}

export interface PairingLink {
    link: string;
    expiresAt: string;
}

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

export type InternetAccessFailureReason =
    | 'no-router'
    | 'cgnat'
    | 'double-nat'
    | 'port-refused'
    | 'not-reachable'
    | 'public-address-unknown'
    | 'rate-limited'
    | 'authority-unavailable'
    | 'https-unavailable'
    | 'domain-unresolved'
    | 'domain-mismatch'
    | 'setup-failed';

export interface InternetAccessStatus {
    phase: 'off' | 'setting-up' | 'waiting-for-port' | 'active';
    step: 'router' | 'port' | 'certificate' | null;
    mapping: 'upnp' | 'nat-pmp' | 'manual' | null;
    publicAddress: string | null;
    domain: string | null;
    certificate: { address: string; issuedAt: string; expiresAt: string } | null;
    failure: { reason: InternetAccessFailureReason; at: string } | null;
    failedAttempts: number;
    nextAttemptAt: string | null;
    retryAfter: string | null;
    awaitingCheck: boolean;
    allowances: {
        certificates: { left: number; nextAt: string | null };
        checks: { left: number; nextAt: string | null };
    } | null;
    origin: string | null;
    manualRule: {
        localAddress: string | null;
        internalPort: number;
        externalPort: number;
        protocol: 'TCP';
    } | null;
}

export interface HttpInternetAccessStatus {
    phase: 'off' | 'open';
    mapping: 'upnp' | 'nat-pmp' | 'manual' | null;
    publicAddress: string | null;
    failure: {
        reason: Extract<
            InternetAccessFailureReason,
            | 'no-router'
            | 'port-refused'
            | 'cgnat'
            | 'double-nat'
            | 'public-address-unknown'
            | 'setup-failed'
        >;
        at: string;
    } | null;
    closedByHttps: boolean;
    origin: string | null;
    manualRule: {
        localAddress: string | null;
        internalPort: number;
        externalPort: number;
        protocol: 'TCP';
    } | null;
}

export interface ServerStatus {
    configured: {
        http: { port: number };
        tls: TlsConfiguration;
    };
    internetAccess: InternetAccessStatus;
    keepAwake: boolean;
    domainName: string | null;
    httpInternetAccess: HttpInternetAccessStatus;
    running: {
        httpPort: number;
        httpsPort: number | null;
        httpsError: string | null;
        addresses: string[];
        httpPortOverride: {
            port: number;
            source: 'command-line' | 'environment' | 'config-file';
        } | null;
    };
    restartRequired: boolean;
}

export type ColorSchemeName =
    | 'spring-green'
    | 'midnight-blue'
    | 'velvet-violet'
    | 'ember'
    | 'rose-noir'
    | 'graphite-gold'
    | 'slate-orchid'
    | 'charcoal-scarlet';

export type IconSetName =
    | 'lucide'
    | 'solid-silhouettes'
    | 'hand-inked-editorial'
    | 'architectural-wireframes'
    | 'single-ink-risograph'
    | 'quiet-editorial-monoline';

export interface Appearance {
    colorScheme: ColorSchemeName;
    iconSet: IconSetName;
}

export type BookCategory = 'books' | 'manga' | 'comics';
export type BookOwnership = 'owned' | 'not-owned';
export type BookSort = 'title' | 'added' | 'published';

export interface AuthorDto {
    id: string;
    name: string;
}

export type AuthorChoiceDto = { id: string } | { name: string; distinct?: boolean };

export type CollectionChoiceDto = { id: string } | { name: string; distinct?: boolean };

export interface MembershipDto {
    collection: CollectionChoiceDto;
    volumeFrom: number;
    volumeTo: number;
    enableVolumeZero?: boolean;
}

export type TagChoiceDto = { id: string } | { name: string };

export interface BookLocationDto {
    bookcaseId: string;
    bookcaseName: string;
    shelfId: string;
    shelfName: string;
}

export interface BookTagDto {
    id: string;
    name: string;
}

export interface BookCollectionDto {
    id: string;
    name: string;
    volumeFrom: number;
    volumeTo: number;
}

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
    replacePlanned?: string[];
    shelfId: string | null;
    tags: TagChoiceDto[];
}

export interface BookOrganisationDto {
    shelfId?: string | null;
    tags?: TagChoiceDto[];
}

export interface NewBookDto extends BookInputDto {
    read: boolean;
}

export interface BookBatchChangesDto {
    ownership?: BookOwnership;
    publisher?: string | null;
    price?: string | null;
    shelfId?: string | null;
    tags?: { add: string[]; remove: string[] };
    authors?: AuthorChoiceDto[];
    read?: boolean;
    generatedTitles?: true;
    onlyIfEmpty?: BookBatchFillable[];
}

export type BookBatchFillable = 'publisher' | 'price' | 'shelfId';

export interface BookBatchInputDto {
    collectionId: string;
    bookIds: string[];
    preview: boolean;
    changes: BookBatchChangesDto;
}

export interface BookBatchFieldsDto {
    title?: string;
    titleGenerated?: boolean;
    ownership?: BookOwnership;
    publisher?: string | null;
    priceCents?: number | null;
    authors?: string[];
    location?: BookLocationDto | null;
    tags?: BookTagDto[];
    read?: boolean;
}

export type BookBatchSkipReason = 'book-lent' | 'possible-duplicate' | 'title-not-generated';

export interface BookBatchDto {
    collection: { id: string; name: string };
    saved: boolean;
    books: { id: string; title: string; before: BookBatchFieldsDto; after: BookBatchFieldsDto }[];
    skipped: { id: string; title: string; reason: BookBatchSkipReason }[];
}

export interface PersonalNoteDto {
    text: string;
    updatedAt: string;
}

export interface BookLoanDto {
    id: string;
    receiverId: string;
    receiverName: string;
    lentAt: string;
}

export interface BookDto {
    id: string;
    title: string;
    titleGenerated: boolean;
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
    location: BookLocationDto | null;
    tags: BookTagDto[];
    loan: BookLoanDto | null;
    createdAt: string;
    updatedAt: string;
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
    loan: BookLoanDto | null;
}

export interface BookListPageDto {
    total: number;
    items: BookListItemDto[];
}

export interface BookFilterParams {
    category?: BookCategory[];
    author?: string[];
    collection?: string[];
    location?: string[];
    ownership?: BookOwnership[];
    cover?: ('with' | 'without')[];
    price?: ('with' | 'without')[];
    reading?: ('read' | 'unread')[];
    tag?: string[];
    notTag?: string[];
}

export interface SimilarAuthorDetails {
    name: string;
    candidates: AuthorDto[];
}

export interface PossibleDuplicateDetails {
    candidates: { id: string; title: string; authors: string[] }[];
}

export interface SimilarCollectionDetails {
    name: string;
    candidates: { id: string; name: string }[];
}

export interface CategoryMismatchDetails {
    collectionId: string;
    name: string;
    category: BookCategory;
    bookCategory: BookCategory;
    bookCount: number;
}

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

export interface CoverageConflictDetails {
    name: string;
    conflicts: CoverageConflictBook[];
    replaceable: boolean;
    expectedAfterReplacement: { from: number; to: number | null } | null;
}

export type VolumeState = 'owned' | 'planned' | 'inferred';

export interface LookupChoiceDto<T> {
    value: T;
    sources: string[];
}

export interface BookLookupFieldsDto {
    title: LookupChoiceDto<string>[];
    authors: LookupChoiceDto<string[]>[];
    publisher: LookupChoiceDto<string>[];
    publicationDate: LookupChoiceDto<{ year: number; month: number | null }>[];
    pageCount: LookupChoiceDto<number>[];
    summary: LookupChoiceDto<string>[];
    collection: LookupChoiceDto<{ name: string; volume: number }>[];
    category: LookupChoiceDto<BookCategory>[];
}

export interface AuthorSpellingDto {
    name: string;
    spelling: string;
    sources: string[];
}

export interface LookupCoverDto {
    token: string;
    width: number | null;
    height: number | null;
    sources: string[];
}

export type BookLookupDto =
    | { kind: 'existing'; bookId: string }
    | {
          kind: 'looked-up';
          isbn13: string;
          found: boolean;
          fields: BookLookupFieldsDto;
          authorSpellings: AuthorSpellingDto[];
          covers: LookupCoverDto[];
          unavailable: { source: string; reason: 'limited' | 'failed' }[];
      };

export interface CollectionSummaryDto {
    id: string;
    name: string;
    category: BookCategory;
    includesVolumeZero: boolean;
    finished: boolean;
    bookCount: number;
    expectedFrom: number;
    expectedTo: number;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
    previews: CollectionPreviewDto[];
}

export interface CollectionPreviewDto {
    id: string;
    title: string;
    updatedAt: string;
}

export interface CollectionMemberDto {
    id: string;
    title: string;
    isbn: string | null;
    publisher: string | null;
    category: BookCategory;
    ownership: BookOwnership;
    hasCover: boolean;
    updatedAt: string;
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

export interface CollectionReadingDto {
    read: boolean;
    ownedCount: number;
}

export interface CollectionListPageDto {
    total: number;
    items: CollectionSummaryDto[];
}

export interface ShoppingCollectionDto {
    id: string;
    name: string;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
}

export interface CollectionShoppingDto {
    id: string;
    name: string;
    finished: boolean;
    expectedCount: number;
    ownedCount: number;
    lastOwned: { volume: number; title: string | null } | null;
    missing: {
        volume: number;
        saved: boolean;
        quickAdd: { bookId: string; title: string } | null;
    }[];
}

export interface CollectionNameDto {
    id: string;
    name: string;
    category: BookCategory;
    includesVolumeZero: boolean;
}

export interface CollectionChangesDto {
    name?: string;
    category?: BookCategory;
    includesVolumeZero?: boolean;
}

export interface ShelfDto {
    id: string;
    bookcaseId: string;
    name: string;
    bookCount: number;
}

export interface BookcaseDto {
    id: string;
    name: string;
    bookCount: number;
    shelves: ShelfDto[];
}

export interface NameDto {
    name: string;
}

export interface ShelfChangesDto {
    name?: string;
    bookcaseId?: string;
}

export interface TagDto {
    id: string;
    name: string;
    bookCount: number;
}

export interface ReceiverDto {
    id: string;
    name: string;
}

export type ReceiverChoiceDto = { id: string } | { name: string; distinct?: boolean };

export interface LendBooksDto {
    receiver: ReceiverChoiceDto;
    bookIds: string[];
}

export interface LendingDto {
    receiver: ReceiverDto;
    loans: { loanId: string; bookId: string; lentAt: string }[];
}

export interface RecordReturnsDto {
    loanIds: string[];
}

export interface ReturnDto {
    receiver: ReceiverDto;
    returned: { loanId: string; bookId: string | null; returnedAt: string }[];
}

export interface LoanBookDto {
    id: string;
    title: string;
    authors: string[];
    publisher: string | null;
    publicationYear: number | null;
    isbn: string | null;
    hasCover: boolean;
    updatedAt: string;
}

export interface ActiveLoanDto {
    loanId: string;
    lentAt: string;
    book: LoanBookDto;
}

export interface ReceiverLoansDto {
    receiver: ReceiverDto;
    loans: ActiveLoanDto[];
}

export type ActivityEventDto =
    | {
          kind:
              | 'book-added'
              | 'book-updated'
              | 'book-marked-owned'
              | 'book-deleted'
              | 'book-relocated'
              | 'book-retagged'
              | 'book-organised'
              | 'book-cover-changed';
          title: string | null;
      }
    | { kind: 'books-lent' | 'books-returned'; receiver: string; titles: string[] }
    | { kind: 'collection-category-changed'; name: string; category: BookCategory; count: number }
    | {
          kind:
              | 'collection-created'
              | 'collection-updated'
              | 'collection-finished'
              | 'collection-reopened'
              | 'collection-deleted'
              | 'collection-removed'
              | 'bookcase-created'
              | 'bookcase-deleted'
              | 'tag-created'
              | 'tag-deleted'
              | 'receiver-created';
          name: string;
      }
    | {
          kind: 'author-corrected' | 'collection-renamed' | 'bookcase-renamed' | 'tag-renamed';
          from: string;
          to: string;
      }
    | { kind: 'shelf-created' | 'shelf-deleted'; name: string; bookcase: string }
    | { kind: 'shelf-renamed'; from: string; to: string; bookcase: string }
    | { kind: 'shelf-moved'; name: string; from: string; to: string };

export interface ActivityEntryDto {
    id: string;
    occurredAt: string;
    actor: string | null;
    event: ActivityEventDto;
    also: ActivityEventDto[];
}

export interface ActivityPageDto {
    entries: ActivityEntryDto[];
    older: string | null;
}

export interface OverviewDto {
    ownedBooks: number;
    collections: number;
    bookcases: number;
    shelves: number;
    lentBooks: number;
    recentlyAdded: {
        id: string;
        title: string;
        authors: string[];
        hasCover: boolean;
        updatedAt: string;
        read: boolean | null;
    }[];
    reading: { read: number; notRead: number } | null;
    bookcaseList: { id: string; name: string; shelfCount: number }[];
}
