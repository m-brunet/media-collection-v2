export interface ApplicationDataEraser {
    erase(keptAccountId: string): Promise<void>;
}
