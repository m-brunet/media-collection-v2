// Addresses of the lending pages, shared by the pages that link to them.
export class LoanLinks {
    static readonly list = '/loans';

    // Lending starting from one book, which is preselected.
    static lend(bookId: string): string {
        return '/loans/lend?book=' + encodeURIComponent(bookId);
    }

    // The returns of one receiver, the given loan preselected.
    static returns(receiverId: string, loanId: string): string {
        return (
            '/loans/return?receiver=' +
            encodeURIComponent(receiverId) +
            '&loan=' +
            encodeURIComponent(loanId)
        );
    }
}
