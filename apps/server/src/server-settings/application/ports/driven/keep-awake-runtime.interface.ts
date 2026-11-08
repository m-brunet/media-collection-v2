// Asks the desktop host not to sleep while the application runs.
export interface KeepAwakeRuntime {
    apply(enabled: boolean): void;
}
