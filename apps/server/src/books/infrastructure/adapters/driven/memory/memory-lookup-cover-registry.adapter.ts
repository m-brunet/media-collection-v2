import { randomUUID } from 'node:crypto';
import type { LookupCoverRegistry } from '../../../../application/ports/driven/lookup-cover-registry.interface.js';
import type { Clock } from '../../../../../shared/application/ports/driven/clock.interface.js';

export class MemoryLookupCoverRegistry implements LookupCoverRegistry {
    static readonly keptMinutes = 30;

    private readonly covers = new Map<string, { address: string; until: number }>();

    constructor(private readonly clock: Clock) {}

    register(address: string): string {
        const now = this.clock.now().getTime();

        for (const [token, cover] of this.covers) {
            if (cover.until <= now) {
                this.covers.delete(token);
            }
        }

        const token = randomUUID();

        this.covers.set(token, {
            address,
            until: now + MemoryLookupCoverRegistry.keptMinutes * 60_000,
        });

        return token;
    }

    address(token: string): string | null {
        const cover = this.covers.get(token);

        return cover && cover.until > this.clock.now().getTime() ? cover.address : null;
    }
}
