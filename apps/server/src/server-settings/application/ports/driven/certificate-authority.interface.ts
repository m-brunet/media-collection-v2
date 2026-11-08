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

// Let's Encrypt: a short-lived certificate for a public IPv4 address, proven on external port 443.
export interface CertificateAuthority {
    issue(address: string): Promise<CertificateIssue>;
}
