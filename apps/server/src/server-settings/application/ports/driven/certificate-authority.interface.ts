import type { InternetAccessFailureReason } from '../../../domain/entities/internet-access.entity.js';
import type { CertificateMaterial } from './certificate-material.interface.js';

export type CertificateIssue =
    // `renewal`: Let's Encrypt accepted the order as an ARI renewal of `replacing`, which no rate
    // limit counts.
    | { outcome: 'issued'; certificate: CertificateMaterial; renewal: boolean }
    | {
          outcome: 'refused';
          reason: Extract<InternetAccessFailureReason, 'not-reachable' | 'authority-unavailable'>;
      }
    | { outcome: 'refused'; reason: 'rate-limited'; retryAfter: string | null };

export type CertificateSubject = { kind: 'address' | 'domain'; name: string };

// Let's Encrypt, proven on external port 443: a short-lived certificate for an address, a classic
// one for a domain name. `replacing`: the chain (PEM) of the certificate this one renews, for the
// same name; null for a new name.
export interface CertificateAuthority {
    issue(subject: CertificateSubject, replacing: string | null): Promise<CertificateIssue>;
}
