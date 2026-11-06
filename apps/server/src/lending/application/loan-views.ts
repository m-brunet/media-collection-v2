// Read models of the lending pages. Dates are UTC ISO strings; interfaces display them in the
// viewer's own time zone and language.

export interface LoanBookView {
    id: string;
    title: string;
    authors: string[];
    publisher: string | null;
    publicationYear: number | null;
    isbn: string | null;
    hasCover: boolean;
    // Last change of the book, which versions its cover address.
    updatedAt: string;
}

export interface ActiveLoanView {
    loanId: string;
    lentAt: string;
    book: LoanBookView;
}

// One receiver with the books currently lent to them, newest loan first.
export interface ReceiverLoansView {
    receiver: { id: string; name: string };
    loans: ActiveLoanView[];
}

export interface ActiveLoansQuery {
    // Matches the receiver name or the book title (case, accents and outer spaces ignored).
    search: string | null;
    receiverId: string | null;
}
