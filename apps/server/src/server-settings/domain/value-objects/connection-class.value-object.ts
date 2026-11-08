import { Failure } from '../../../shared/domain/exceptions/failure.js';

export type ConnectionKind = 'public' | 'cgnat' | 'private';

// What the router's external IPv4 address says about the home connection. Only a public address
// can receive connections from the internet: a CGNAT address is shared by the provider, and a
// private one means the router sits behind another router.
export class ConnectionClass {
    private constructor(
        readonly address: string,
        readonly kind: ConnectionKind,
    ) {
        Object.freeze(this);
    }

    static of(address: string): ConnectionClass {
        const octets = ConnectionClass.octets(address);

        return new ConnectionClass(octets.join('.'), ConnectionClass.kindOf(octets));
    }

    get reachable(): boolean {
        return this.kind === 'public';
    }

    private static octets(address: string): [number, number, number, number] {
        const parts = address.trim().split('.');
        const valid =
            parts.length === 4 &&
            parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);

        Failure.ensure(
            valid,
            'The router reported an address that is not IPv4.',
            'address-invalid',
        );

        return parts.map(Number) as [number, number, number, number];
    }

    private static kindOf([first, second]: readonly [
        number,
        number,
        number,
        number,
    ]): ConnectionKind {
        if (first === 100 && second >= 64 && second <= 127) {
            return 'cgnat';
        }

        const local =
            first === 0 ||
            first === 10 ||
            first === 127 ||
            first >= 224 ||
            (first === 169 && second === 254) ||
            (first === 172 && second >= 16 && second <= 31) ||
            (first === 192 && second === 168);

        return local ? 'private' : 'public';
    }
}
