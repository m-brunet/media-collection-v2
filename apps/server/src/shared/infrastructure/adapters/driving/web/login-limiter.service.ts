import type { Request } from 'express';
import { ForbiddenException } from '@nestjs/common';

export class LoginLimiter {
    private readonly attempts = new Map<string, { count: number; start: number }>();

    check(request: Request): void {
        const key = request.ip ?? 'unknown';
        const now = Date.now();

        if (this.attempts.size > 10000) {
            for (const [ip, entry] of this.attempts) {
                if (entry.start + 60000 <= now) {
                    this.attempts.delete(ip);
                }
            }
        }

        const previous = this.attempts.get(key);
        const entry =
            !previous || previous.start + 60000 <= now ? { count: 0, start: now } : previous;

        entry.count++;
        this.attempts.set(key, entry);

        if (entry.count > 30) {
            throw new ForbiddenException(
                'Too many sign-in attempts. Wait one minute and try again.',
            );
        }
    }
}
