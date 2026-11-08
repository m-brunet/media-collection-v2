export interface FindProtectedAdministratorUseCase {
    execute(): Promise<{ username: string } | null>;
}
