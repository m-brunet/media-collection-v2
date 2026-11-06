import type { Receiver } from '../../../domain/entities/receiver.entity.js';

export interface ReceiverRepository {
    findById(id: string): Promise<Receiver | null>;
    // Receivers that do not exist are left out.
    findByIds(ids: readonly string[]): Promise<Receiver[]>;
    findByKey(key: string): Promise<Receiver | null>;
    // Ordered by name.
    list(): Promise<Receiver[]>;
    create(receiver: Receiver): Promise<void>;
}
