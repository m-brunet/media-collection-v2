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
    // The domain name the HTTPS certificate uses (follows the saved domain name).
    domain: string | null;
    // `address` is the IP address or the domain name the certificate covers.
    certificate: { address: string; issuedAt: string; expiresAt: string } | null;
    failure: { reason: InternetAccessFailureReason; at: string } | null;
    failedAttempts: number;
    nextAttemptAt: string | null;
    // Let's Encrypt's own date after a rate limit, while it is ahead: no attempt is accepted before it.
    retryAfter: string | null;
    // Active, after a failed check: the certificate waits for Check again.
    awaitingCheck: boolean;
    // What Let's Encrypt probably still allows for the address or domain name, after a failure (an
    // estimate from this installation's own attempts); `nextAt` while none is left.
    allowances: {
        certificates: { left: number; nextAt: string | null };
        checks: { left: number; nextAt: string | null };
    } | null;
    // The address phones open (domain name, else public address), once the certificate is in use.
    origin: string | null;
    // What to enter in the router when it cannot be configured automatically.
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
    // Closed by a working HTTPS setup rather than by the Admin.
    closedByHttps: boolean;
    // The address phones open while it is open (domain name, else public address).
    origin: string | null;
    // What to enter in the router when the application could not add the rule.
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
    // The Admin's domain name, used by the internet addresses; checked when saved.
    domainName: string | null;
    httpInternetAccess: HttpInternetAccessStatus;
    running: {
        httpPort: number;
        httpsPort: number | null;
        httpsError: string | null;
        addresses: string[];
        httpPortOverride: { port: number; source: 'command-line' | 'environment' } | null;
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

// Installation-wide appearance, readable before sign-in.
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

// A tag of a book being saved: an existing tag, or a name to reuse (equivalent name) or create.
export type TagChoiceDto = { id: string } | { name: string };

// Where a book is kept: always a shelf within its bookcase.
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

// A blank `title` on a Manga or Comics in a collection asks for one generated from the
// collection; any other blank title is refused (`title-required`). Typed text is always kept.
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
    // An existing shelf, or null for no physical location.
    shelfId: string | null;
    tags: TagChoiceDto[];
}

// `PATCH /api/books/:id/organisation`: location and tags edited on the book details. An absent
// field is left unchanged.
export interface BookOrganisationDto {
    shelfId?: string | null;
    tags?: TagChoiceDto[];
}

export interface NewBookDto extends BookInputDto {
    // The creator's own reading status.
    read: boolean;
}

export interface PersonalNoteDto {
    text: string;
    updatedAt: string;
}

// The active loan of a book: who has it and since when (UTC).
export interface BookLoanDto {
    id: string;
    receiverId: string;
    receiverName: string;
    lentAt: string;
}

export interface BookDto {
    id: string;
    title: string;
    // True when the title is generated from the book's collection (`Name - N`).
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
    // Ordered by name.
    tags: BookTagDto[];
    loan: BookLoanDto | null;
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
    loan: BookLoanDto | null;
}

export interface BookListPageDto {
    total: number;
    items: BookListItemDto[];
}

// Advanced filters of `GET /api/books` and `GET /api/collections`, sent as repeated query
// parameters (`?category=manga&category=comics`). Different parameters combine with AND, values
// of one parameter with OR; every `tag` must be present and any `notTag` rejects a book.
// `collection`: a collection id or `none`. `location`: `bookcase:<id>`, `shelf:<id>` or `none`.
// `reading` is the viewer's own status and is refused for Guests (`reading-filter-unavailable`).
export interface BookFilterParams {
    category?: BookCategory[];
    author?: string[];
    collection?: string[];
    location?: string[];
    ownership?: BookOwnership[];
    reading?: ('read' | 'unread')[];
    tag?: string[];
    notTag?: string[];
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

export interface LookupChoiceDto<T> {
    value: T;
    sources: string[];
}

// Each field's choices, the preferred source's value first; empty when no source knew it.
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

// A cover offered by a lookup, shown from `/api/books/lookups/covers/:token` for half an hour.
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
          covers: LookupCoverDto[];
          unavailable: { source: string; reason: 'limited' | 'failed' }[];
      };

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
    // Up to two books whose covers stand for the collection.
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

export interface CollectionListPageDto {
    total: number;
    items: CollectionSummaryDto[];
}

// `GET /api/collections/shopping`: an unfinished collection in Leaf's shopping list.
export interface ShoppingCollectionDto {
    id: string;
    name: string;
    expectedCount: number;
    ownedCount: number;
    missingCount: number;
    lastOwned: number | null;
}

// `GET /api/collections/:id/shopping`: the last Owned volume (with its title in the Books
// category) and the missing volumes in order. `quickAdd`: the saved single-volume Not Owned book
// that may be marked Owned with `POST /api/books/:id/owned`.
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
    includesVolumeZero: boolean;
}

export interface CollectionChangesDto {
    name?: string;
    includesVolumeZero?: boolean;
}

export interface ShelfDto {
    id: string;
    bookcaseId: string;
    name: string;
    bookCount: number;
}

// Shelves in name order, numbers compared by value.
export interface BookcaseDto {
    id: string;
    name: string;
    // Books on all its shelves.
    bookCount: number;
    shelves: ShelfDto[];
}

// Body of `POST /api/bookcases`, `PATCH /api/bookcases/:id`, `POST /api/bookcases/:id/shelves`,
// `POST /api/tags` and `PATCH /api/tags/:id`.
export interface NameDto {
    name: string;
}

// Body of `PATCH /api/shelves/:id`: a rename, a move to another bookcase, or both.
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

// An existing receiver, or a name to reuse or create. `distinct` confirms that a name similar to
// an existing receiver (`receiver-similar`) is really someone else.
export type ReceiverChoiceDto = { id: string } | { name: string; distinct?: boolean };

// `POST /api/loans`: lends the books together, or none of them.
export interface LendBooksDto {
    receiver: ReceiverChoiceDto;
    bookIds: string[];
}

export interface LendingDto {
    receiver: ReceiverDto;
    loans: { loanId: string; bookId: string; lentAt: string }[];
}

// `POST /api/loans/returns`: returns loans of one receiver together, or none of them.
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

// `GET /api/loans`: the books currently lent, grouped by receiver in name order, newest first.
export interface ReceiverLoansDto {
    receiver: ReceiverDto;
    loans: ActiveLoanDto[];
}

// `title` is null only for an older record of a book deleted since.
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
    // The audit operation ID.
    id: string;
    // UTC.
    occurredAt: string;
    // The acting account's current username; null when no account was recorded.
    actor: string | null;
    event: ActivityEventDto;
    also: ActivityEventDto[];
}

// `GET /api/activity?before=`: newest first. Pass `older` as `before` for the next page; null
// when nothing older exists.
export interface ActivityPageDto {
    entries: ActivityEntryDto[];
    older: string | null;
}

// `GET /api/overview`: shared counters (Owned books are saved Owned editions), the five most
// recently added Owned books, and the viewer's own reading over Owned books. A Guest gets
// `reading: null` and `read: null` on each book.
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
    // In name order.
    bookcaseList: { id: string; name: string; shelfCount: number }[];
}
