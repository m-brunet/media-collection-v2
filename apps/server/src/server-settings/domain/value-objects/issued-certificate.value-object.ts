import { Failure } from '../../../shared/domain/exceptions/failure.js';

export interface IssuedCertificateState {
    address: string;
    issuedAt: string;
    expiresAt: string;
}

// An automatically issued certificate: the public address it covers and its validity period.
// Key material never enters the domain.
export class IssuedCertificate {
    private readonly state: Readonly<IssuedCertificateState>;

    constructor(state: IssuedCertificateState) {
        const issued = Date.parse(state.issuedAt);
        const expires = Date.parse(state.expiresAt);

        Failure.ensure(
            Number.isFinite(issued) && Number.isFinite(expires) && issued < expires,
            'A certificate must expire after it was issued.',
            'certificate-period-invalid',
        );
        this.state = Object.freeze({ ...state });
        Object.freeze(this);
    }

    get address(): string {
        return this.state.address;
    }

    get issuedAt(): Date {
        return new Date(this.state.issuedAt);
    }

    get expiresAt(): Date {
        return new Date(this.state.expiresAt);
    }

    validAt(now: Date): boolean {
        return now.getTime() < this.expiresAt.getTime();
    }

    snapshot(): IssuedCertificateState {
        return { ...this.state };
    }
}
