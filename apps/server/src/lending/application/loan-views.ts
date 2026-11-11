export interface LoanBookView {
    id: string;
    title: string;
    authors: string[];
    publisher: string | null;
    publicationYear: number | null;
    isbn: string | null;
    hasCover: boolean;
    updatedAt: string;
}

export interface ActiveLoanView {
    loanId: string;
    lentAt: string;
    book: LoanBookView;
}

export interface ReceiverLoansView {
    receiver: { id: string; name: string };
    loans: ActiveLoanView[];
}

export interface ActiveLoansQuery {
    search: string | null;
    receiverId: string | null;
}
