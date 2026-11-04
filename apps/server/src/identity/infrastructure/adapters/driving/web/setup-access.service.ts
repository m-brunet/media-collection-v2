import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

// First-launch setup is reserved to the Media Collection desktop window. At each launch the
// Electron main process creates a random secret, gives it to the backend, and attaches it only
// to setup requests from its own window. Browsers, even on the same computer, never learn it.
export class SetupAccess {
    static readonly header = 'x-media-collection-setup';

    constructor(private readonly secret: string | null) {}

    allows(request: Request): boolean {
        const supplied = request.get(SetupAccess.header);

        if (!this.secret || !supplied) {
            return false;
        }

        const expected = Buffer.from(this.secret);
        const received = Buffer.from(supplied);

        return expected.length === received.length && timingSafeEqual(expected, received);
    }
}
