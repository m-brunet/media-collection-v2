// Inputs and outcomes of the lending use cases.

// The person receiving the books: an existing receiver, or a name to reuse or create.
// `distinct` confirms that a name similar to an existing receiver is really someone else.
export type ReceiverChoice = { id: string } | { name: string; distinct?: boolean };

export interface LendRequest {
    receiver: ReceiverChoice;
    // At least one book, each once; the starting book may have been removed.
    bookIds: string[];
}

export interface ReceiverReference {
    id: string;
    name: string;
}

export interface LendingOutcome {
    receiver: ReceiverReference;
    loans: { loanId: string; bookId: string; lentAt: string }[];
}

export interface ReturnOutcome {
    receiver: ReceiverReference;
    returned: { loanId: string; bookId: string | null; returnedAt: string }[];
}
