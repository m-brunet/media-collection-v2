export interface HttpsRuntime {
    runningPort(): number | null;
    ensureRunning(port: number): Promise<boolean>;
    install(port: number, certificate: { chain: string; key: string }): Promise<boolean>;
}
