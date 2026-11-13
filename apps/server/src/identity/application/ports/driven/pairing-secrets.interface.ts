export interface PairingSecrets {
    generate(): string;
    hash(code: string): string;
}
