import type { Clock } from '../../../../application/ports/driven/clock.interface.js';

export class SystemClock implements Clock {
    now(): Date {
        return new Date();
    }
}
