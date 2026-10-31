export interface CertificateValidator {
    validate(chain: string, key: string): void;
}
