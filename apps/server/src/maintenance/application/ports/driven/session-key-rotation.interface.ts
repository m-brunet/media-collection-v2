export interface SessionKeyRotation {
    rotate(): Promise<void>;
}
