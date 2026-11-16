export interface ApplicationDataEraser {
    erase(keptAccountId: string, deleteKeptCovers: boolean): Promise<void>;
}
