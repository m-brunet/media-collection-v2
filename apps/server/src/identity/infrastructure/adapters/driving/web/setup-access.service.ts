import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

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
