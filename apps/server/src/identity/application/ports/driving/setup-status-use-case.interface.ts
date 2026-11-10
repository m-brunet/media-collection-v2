export interface SetupStatusUseCase {
    execute(): Promise<{ required: boolean }>;
}
