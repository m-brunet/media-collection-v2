export interface RecoverAdministratorUseCase {
    execute(password: string): Promise<{ username: string }>;
}
