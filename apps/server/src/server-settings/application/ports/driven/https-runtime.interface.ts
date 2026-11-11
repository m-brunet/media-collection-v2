export interface HttpsRuntime {
    ensureRunning(port: number): Promise<boolean>;
    install(port: number, certificate: { chain: string; key: string }): Promise<boolean>;
}
