export interface AdministratorPasswordCheck {
    // Throws a `password-incorrect` failure when the password is not the account's current one.
    confirm(accountId: string, password: string): Promise<void>;
}
