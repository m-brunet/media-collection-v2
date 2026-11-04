export interface SetupStatusUseCase {
    // True until the protected administrator has been created on first launch.
    execute(): Promise<{ required: boolean }>;
}
