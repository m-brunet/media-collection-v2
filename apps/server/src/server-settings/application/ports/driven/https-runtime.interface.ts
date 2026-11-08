// The running HTTPS listener. `prepare` starts it when needed, so the certificate authority can
// reach it; `install` swaps the certificate without a restart. Both answer false when the
// listener cannot run (for example, its port is taken).
export interface HttpsRuntime {
    ensureRunning(port: number): Promise<boolean>;
    install(port: number, certificate: { chain: string; key: string }): Promise<boolean>;
}
