import type { InternetAccessFailureReason } from '../../../domain/entities/internet-access.entity.js';
import type { CertificateMaterial } from './certificate-material.interface.js';

export type CertificateIssue =
    | { outcome: 'issued'; certificate: CertificateMaterial }
    | {
          outcome: 'refused';
          reason: Extract<
              InternetAccessFailureReason,
              'not-reachable' | 'rate-limited' | 'authority-unavailable'
          >;
      };

// What the certificate covers: the home's public IPv4 address or the Admin's domain name.
export type CertificateSubject = { kind: 'address' | 'domain'; name: string };

// Let's Encrypt, proven on external port 443: a short-lived certificate for an address, a classic
// one for a domain name.
export interface CertificateAuthority {
    issue(subject: CertificateSubject): Promise<CertificateIssue>;
}
