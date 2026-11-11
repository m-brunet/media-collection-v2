import type { Receiver } from '../../../domain/entities/receiver.entity.js';

export interface ReceiverRepository {
    findById(id: string): Promise<Receiver | null>;
    findByIds(ids: readonly string[]): Promise<Receiver[]>;
    findByKey(key: string): Promise<Receiver | null>;
    list(): Promise<Receiver[]>;
    create(receiver: Receiver): Promise<void>;
}
