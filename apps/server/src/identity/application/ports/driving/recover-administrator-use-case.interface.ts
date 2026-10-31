export interface RecoverAdministratorUseCase {
    execute(username: string, password: string): Promise<void>;
}
