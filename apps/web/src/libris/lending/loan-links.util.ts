export class LoanLinks {
    static readonly list = '/loans';

    static lend(bookId: string): string {
        return '/loans/lend?book=' + encodeURIComponent(bookId);
    }

    static returns(receiverId: string, loanId: string): string {
        return (
            '/loans/return?receiver=' +
            encodeURIComponent(receiverId) +
            '&loan=' +
            encodeURIComponent(loanId)
        );
    }
}
