// Covers offered by a lookup, kept for a short while under random tokens, so that source
// addresses never reach the browser and only addresses a source offered are ever downloaded.
export interface LookupCoverRegistry {
    register(address: string): string;
    // The address behind a token, or null once it expired or when it was never issued.
    address(token: string): string | null;
}
