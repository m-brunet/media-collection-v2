// Deletes the library, the audit history, every account except the kept one and the saved
// application preferences, and ends every session. Joins the transaction in progress.
export interface ApplicationDataEraser {
    erase(keptAccountId: string): Promise<void>;
}
