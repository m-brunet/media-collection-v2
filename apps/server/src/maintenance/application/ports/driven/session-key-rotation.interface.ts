// Replaces the session signing key, so every existing session ends.
export interface SessionKeyRotation {
    rotate(): Promise<void>;
}
