import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../../../application/ports/driven/id-generator.interface.js';

export class UuidGenerator implements IdGenerator {
    next(): string {
        return randomUUID();
    }
}
