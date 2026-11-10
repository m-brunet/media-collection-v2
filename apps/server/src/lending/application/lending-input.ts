// `distinct` confirms that a name similar to an existing receiver is really someone else.
export type ReceiverChoice = { id: string } | { name: string; distinct?: boolean };

export interface LendRequest {
    receiver: ReceiverChoice;
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
