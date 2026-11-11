export interface AdministratorPasswordCheck {
    confirm(accountId: string, password: string): Promise<void>;
}
